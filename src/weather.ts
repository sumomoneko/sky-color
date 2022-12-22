import Ajv, { JTDDataType } from "ajv/dist/jtd";
import { Err, Ok, Result } from "./result";
import { getUnixTime, startOfDay } from "date-fns";
import { ProxyAgent, request, setGlobalDispatcher } from "undici";

export interface ApiParam {
  apiKey: string;
  zipCode: string;
  countryCode: string;
}

export type Location = { lat: number; lon: number };

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}
export class ApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiKeyError";
  }
}
export class ParamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParamError";
  }
}
export class UnknownResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownResponseError";
  }
}

export type FetchError =
  | NetworkError
  | ApiKeyError
  | ParamError
  | UnknownResponseError;

const getSystemHttpsProxyURI = (): string | undefined => {
  return (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    undefined
  );
};

export const setupProxy = () => {
  const httpsProxy = getSystemHttpsProxyURI();
  if (httpsProxy) {
    const proxyAgent = new ProxyAgent(httpsProxy);
    setGlobalDispatcher(proxyAgent);
  }
};

export const getLocationAsync = async (
  param: ApiParam
): Promise<Result<Location, FetchError>> => {
  const geoQueryStr = `https://api.openweathermap.org/geo/1.0/zip?zip=${encodeURIComponent(
    param.zipCode
  )},${encodeURIComponent(param.countryCode)}&appid=${encodeURIComponent(
    param.apiKey
  )}`;

  try {
    const { statusCode, body } = await request(geoQueryStr);

    switch (statusCode) {
      case 401:
        return new Err(new ApiKeyError("Invalid API key."));
      case 404:
        return new Err(new ParamError("ZIP code or country code is unknown."));
      case 200:
        break;
      default:
        return new Err(new UnknownResponseError(`status code: ${statusCode}`));
    }
    const json = await body.json();
    if (!validateLocationJson(json)) {
      return new Err(
        new UnknownResponseError(
          `location API parse error: ${validateLocationJson.errors}`
        )
      );
    }

    console.debug(`fetched: ${json}`);
    return new Ok({ lat: json.lat, lon: json.lon });
  } catch (e) {
    console.log(e);
    if (e instanceof Error) {
      return new Err(new NetworkError(e.message));
    }
    return new Err(new NetworkError("unknown error"));
  }
};

export interface Weather {
  sunrise: number;
  sunset: number;
  cloud: number;
}

export const getWeatherAsync = async (
  location: Location,
  apiKey: string
): Promise<Result<Weather, FetchError>> => {
  const weatherQueryStr = `https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lon}&appid=${apiKey}`;

  try {
    const { statusCode, body } = await request(weatherQueryStr);

    switch (statusCode) {
      case 401:
        return new Err(new ApiKeyError("Invalid API key."));
      case 404:
        return new Err(new ParamError("location is invalid."));
      case 200:
        break;
      default:
        return new Err(new UnknownResponseError(`status code: ${statusCode}`));
    }
    const json = await body.json();
    if (!validateWeatherJson(json)) {
      return new Err(
        new UnknownResponseError(
          `weather API parse error: ${validateWeatherJson.errors}`
        )
      );
    }
    console.debug(`fetched: ${json}`);

    const now = new Date();
    const todayOrigin = getUnixTime(startOfDay(now));
    const sunrise = json.sys.sunrise - todayOrigin;
    const sunset = json.sys.sunset - todayOrigin;

    console.debug(
      `sunrise: ${timeFormat(sunrise)}, sunset: ${timeFormat(sunset)}, cloud: ${
        json.clouds.all
      }`
    );

    return new Ok({ sunrise, sunset, cloud: json.clouds.all });
  } catch (e) {
    if (e instanceof Error) {
      return new Err(new NetworkError(e.message));
    }
    return new Err(new NetworkError("unknown error"));
  }
};

const ajv = new Ajv();

const weatherSchema = {
  properties: {
    clouds: {
      properties: {
        all: { type: "uint8" },
      },
      additionalProperties: true,
    },
    sys: {
      properties: {
        sunrise: { type: "float64" },
        sunset: { type: "float64" },
      },
      additionalProperties: true,
    },
  },
  additionalProperties: true,
} as const;

const validateWeatherJson =
  ajv.compile<JTDDataType<typeof weatherSchema>>(weatherSchema);

const locationSchema = {
  properties: {
    lat: { type: "float64" },
    lon: { type: "float64" },
  },
  additionalProperties: true,
} as const;

const validateLocationJson =
  ajv.compile<JTDDataType<typeof locationSchema>>(locationSchema);

/** format seconds to readable string.
 *
 * @param d seconds
 * @returns formatted string ex. "12:05"
 */
const timeFormat = (d: number) => {
  const hour = Math.floor(d / 3600);
  const minute = Math.floor(d / 60) % 60;

  return `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;
};
