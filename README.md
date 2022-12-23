# Sky Color: Reflects the current sky color in the status bar

Get the latitude, longitude, and weather of the current location from [OpenWeatherMap](https://openweathermap.org/) and set the current sky color in the status bar.

![screen image](https://raw.githubusercontent.com/sumomoneko/sky-color/main/doc/sky-color.gif)

## Features

- Set the current sky color in the status bar.
- The color is whitened depending on the degree of cloudiness.

This extension is inspired by [zk-phi/sky-color-clock: Emacs clock widget](https://github.com/zk-phi/sky-color-clock).  
There are also the following projects based on the same concept:

- for Vim: [mopp/sky-color-clock.vim](https://github.com/mopp/sky-color-clock.vim)
- Desktop app: [opengl-8080/little-sky](https://github.com/opengl-8080/little-sky)

## How to setup

1. Register with [OpenWeatherMap](https://openweathermap.org/) and get an API key.
2. Set API key, Country code, and zip code in _user settings_.
   ![settings](https://raw.githubusercontent.com/sumomoneko/sky-color/main/doc/settings.png)

## Implementation Details

At startup, [Geocoding API](https://openweathermap.org/api/geocoding-api#direct_zip) is used to
obtain latitude and longitude.  
Then, every 30 minutes, [Current weather data API](https://openweathermap.org/current) is used to
obtain the time of the Sunrise/Sunset and cloud degree.  
Every 5 minutes, update the color of the status bar based on the current time.

To update colors, this extension rewrites `workbench.colorCustomizations` in User settings.json.  
The implementation for the color change is based on
[johnpapa/vscode-peacock](https://github.com/johnpapa/vscode-peacock).

## License

- MIT
- Icon Image by [Peter H](https://pixabay.com/ja/users/tama66-1032521/?utm_source=link-attribution&utm_medium=referral&utm_campaign=image&utm_content=3879030) from [Pixabay](https://pixabay.com/ja//?utm_source=link-attribution&utm_medium=referral&utm_campaign=image&utm_content=3879030)
