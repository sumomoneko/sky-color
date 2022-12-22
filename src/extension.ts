import * as vscode from "vscode";
import { clearIntervalAsync, setIntervalAsync } from "set-interval-async";
import {
  getFontColor,
  hexToRgb,
  Hsl,
  hslToRgb,
  mixColor,
  rgbToHex,
  rgbToHsl,
} from "./color";
import {
  getLocationAsync,
  ApiParam,
  getWeatherAsync,
  Location,
  ApiKeyError,
  NetworkError,
  ParamError,
  UnknownResponseError,
  Weather,
  setupProxy,
} from "./weather";
import { getUnixTime, startOfDay } from "date-fns";

export async function activate(context: vscode.ExtensionContext) {
  const sc = new SkyColor();
  context.subscriptions.push(sc);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(() =>
      sc.onDidChangeConfiguration()
    )
  );

  await sc.onDidChangeConfiguration();
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {}

class SkyColor {
  private settings_: ApiParam | undefined;
  private location_: Location | undefined;
  private weather_: Weather | undefined;

  /// periodic fetch sunrise/sunset/cloud information proc handle.
  private weatherUpdaterHandle_:
    | ReturnType<typeof setIntervalAsync>
    | undefined;

  /// periodic color updater handle.
  private colorUpdaterHandle_: ReturnType<typeof setIntervalAsync> | undefined;

  constructor() {
    setupProxy();

    this.weatherUpdaterHandle_ = setIntervalAsync(async () => {
      await this.updateWeather();
    }, 30 * 60 * 1000);

    this.colorUpdaterHandle_ = setIntervalAsync(async () => {
      await this.updateColor();
    }, 1 * 60 * 1000);
  }

  public async onDidChangeConfiguration() {
    const settings = getSettings();
    if (JSON.stringify(this.settings_) === JSON.stringify(settings)) {
      return;
    }
    this.settings_ = settings;
    await this.updateLocation();
    await this.updateWeather();
    await this.updateColor();
  }

  public dispose() {
    if (this.colorUpdaterHandle_) {
      clearIntervalAsync(this.colorUpdaterHandle_);
    }

    if (this.weatherUpdaterHandle_) {
      clearIntervalAsync(this.weatherUpdaterHandle_);
    }
  }

  private async updateLocation() {
    if (this.settings_) {
      const result = await getLocationAsync(this.settings_);
      if (result.isErr()) {
        switch (result.value.constructor) {
          case ApiKeyError:
            vscode.window.showErrorMessage(
              "Invalid/deactivated API Key. (Activation could take several hours)"
            );
            delete this.settings_;
            break;
          case NetworkError:
            // Ignore connection problems.
            break;
          case ParamError:
            vscode.window.showErrorMessage("Unknown ZIP/country code.");
            break;
          case UnknownResponseError:
            vscode.window.showErrorMessage(
              "Invalid response from openweather server."
            );
            break;
        }
        await this.deleteColor();
        return;
      }

      // update member
      this.location_ = { lat: result.value.lat, lon: result.value.lon };
    }
  }

  private async updateWeather() {
    if (!this.location_ || !this.settings_) {
      return;
    }
    const result = await getWeatherAsync(this.location_, this.settings_.apiKey);
    if (result.isErr()) {
      switch (result.value.constructor) {
        case ApiKeyError:
          delete this.settings_;
          break;
        case NetworkError:
        case ParamError:
        case UnknownResponseError:
          console.warn(result.value.message);
          break;
      }
      return;
    }
    this.weather_ = result.value;
  }

  private async deleteColor() {
    const inspect = vscode.workspace
      .getConfiguration()
      .inspect("workbench.colorCustomizations");

    if (!inspect) {
      return;
    }

    const currentValues: Partial<{ [key: string]: unknown }> =
      inspect.globalValue ?? {};

    delete currentValues["statusBar.background"];
    delete currentValues["statusBar.foreground"];

    const workspaceConfig = vscode.workspace.getConfiguration();
    await workspaceConfig.update(
      "workbench.colorCustomizations",
      currentValues,
      vscode.ConfigurationTarget.Global
    );
  }

  private async updateColor() {
    if (!this.weather_) {
      return;
    }
    const now = new Date();
    const currentTime = getUnixTime(now) - getUnixTime(startOfDay(now));

    const background = getSkyColor(currentTime, this.weather_);
    const foreground = getFontColor(background);

    const newColorValues = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "statusBar.background": rgbToHex(background),
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "statusBar.foreground": rgbToHex(foreground),
    };

    const inspect = vscode.workspace
      .getConfiguration()
      .inspect("workbench.colorCustomizations");

    if (!inspect) {
      return {};
    }

    const currentValues: object = inspect.globalValue ?? {};

    const updatedValue = Object.assign(currentValues, newColorValues);

    const workspaceConfig = vscode.workspace.getConfiguration();
    await workspaceConfig.update(
      "workbench.colorCustomizations",
      updatedValue,
      vscode.ConfigurationTarget.Global
    );
    console.debug("config updated.");
  }
}

const getSettings = (): ApiParam | undefined => {
  const config = vscode.workspace.getConfiguration("sky-color");
  const zipCode: string = config.get("locationZipCode") ?? "1000000";
  const countryCode: string =
    vscode.workspace.getConfiguration("sky-color").get("locationCountryCode") ??
    "JP";
  const apiKey: string | undefined = vscode.workspace
    .getConfiguration("sky-color")
    .get("apiKey");

  if (!apiKey) {
    return;
  }

  return { zipCode, countryCode, apiKey };
};

const getSkyColor = (currentTime: number, weather: Weather) => {
  const { sunrise, sunset, cloud } = weather;
  const keyColors = [
    { offset: 0, color: "#111111" },
    { offset: sunrise - 2.0 * 60 * 60, color: "#111111" },
    { offset: sunrise - 1.5 * 60 * 60, color: "#4d548a" },
    { offset: sunrise - 1.0 * 60 * 60, color: "#c486b1" },
    { offset: sunrise - 0.5 * 60 * 60, color: "#ee88a0" },
    { offset: sunrise, color: "#ff7d75" },
    { offset: sunrise + 0.5 * 60 * 60, color: "#f4eeef" },
    { offset: (sunrise + sunset) / 2, color: "#5dc9f1" },
    { offset: sunset - 1.5 * 60 * 60, color: "#9eefe0" },
    { offset: sunset - 1.0 * 60 * 60, color: "#f1e17c" },
    { offset: sunset - 0.5 * 60 * 60, color: "#f86b10" },
    { offset: sunset, color: "#100028" },
    { offset: sunset + 0.5 * 60 * 60, color: "#111111" },
    { offset: 24 * 60 * 60, color: "#111111" },
  ];

  let i = keyColors.findIndex((elem) => elem.offset > currentTime);
  if (i <= 0) {
    i = 1;
  }

  const ratio =
    (currentTime - keyColors[i - 1].offset) /
    (keyColors[i].offset - keyColors[i - 1].offset);
  const clearSkyColor = mixColor(
    hexToRgb(keyColors[i - 1].color),
    hexToRgb(keyColors[i].color),
    1.0 - ratio
  );

  const skyHsl = rgbToHsl(clearSkyColor);
  const cloudedHsl: Hsl = {
    h: skyHsl.h,
    s: skyHsl.s - ((skyHsl.s * cloud) / 100) * 0.9,
    l: Math.min(0.95, (cloud / 100) * 0.15 + skyHsl.l),
  };
  const cloudedColor = hslToRgb(cloudedHsl);

  return cloudedColor;
};
