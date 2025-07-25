﻿# <img src="img/icon.ico" alt="api" width="30"> HoloAlarm
![License](https://img.shields.io/github/license/DongInSong/HoloAlarm)
![Last Commit](https://img.shields.io/github/last-commit/DongInSong/HoloAlarm)
![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/DongInSong/HoloAlarm/total)
## Overview
![Dark Mode](img/sample_full.png)
__HoloAlarm: Your Compact Hololive Stream Companion__

HoloAlarm is a sleek, fan-made desktop app for Hololive dedicated Hololive fans. With its vertical, edge-docking layout and card-based UI, it keeps you updated on live and upcoming streams—without cluttering your screen.

__Key Features:__

- __Minimalist Design:__ A slim, bar-shaped window that stays out of your way.
- __Card-Based UI:__ Easily browse streams in a clean, organized layout.
- __Live Notifications:__ Get instant updates so you never miss a stream.
- __Customizable:__ Personalize your experience with features like 'Favorites' and 'Dark Mode'.

⚠️ Note: Since the application is not code-signed, Windows SmartScreen may show a warning when running the file. You can verify the source code and releases on GitHub before running the application.

## Usage (Windows)

<table>
  <tr>
    <td>

<ol>
  <br>
  <li><strong>Download the Application</strong></li>
    <br>
<p> - Visit the <a href="https://github.com/DongInSong/HoloAlarm/releases" target="_blank">GitHub Releases page</a>.</p>
    <p> - Download the latest `.exe` file from the assets section.</p>
  <br>
  <li><strong>Get API Key from Holodex</strong></li>
    <br>
    <p> - Go to the <a href="https://holodex.net/" target="_blank">Holodex</a> website and log in.</p>
    <p> - Navigate to the `Account` > `Developer Settings` page.</p>
    <p> - Click the "New API Key" button to generate a new API key.</p>
    <p> - Copy the generated API key.</p>
    <br>
  <li><strong>Run the Application and Set API Key</strong></li>
    <br>
    <p> - When you first run the application, you will be prompted to enter the Holodex API key.</p>
    <p> - Paste the copied API key into the input field and save.</p>
</ol>

</td>
    <td>
      <img src="img/sample_api.png" alt="api" width="300">
    </td>
  </tr>
</table>

## Configuration

The application settings are stored in `localSetting.json`. You can find this file in the following locations depending on your operating system:

-   **Windows:** `C:\Users\{USERNAME}\AppData\Roaming\HoloAlarm\localSetting.json`
-   **Linux:** `~/.config/HoloAlarm/localSetting.json`
-   **macOS:** `~/Library/Application Support/HoloAlarm/localSetting.json`


## Build and Run

To build and run this application locally, follow these steps:

1.  **Clone the repository:**
    ```bash
git clone https://github.com/DongInSong/HoloAlarm.git
cd HoloAlarm
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the application:**
    ```bash
    npm start
    ```

## Release

You can create distributable packages for Windows and Linux using the following commands:

-   **For Windows (x64):**
    ```bash
    npm run build:win64
    ```

-   **For Linux (x64):**
    ```bash
    npm run build:linux64
    ```

The release files will be located in the `dist/` directory.

## License

This application is powered by the [Holodex API](https://holodex.net/).

In compliance with the Holodex API license, this project acknowledges Holodex as the data source and provides a link to their service. The source code includes notices referring to the Holodex Public License and its disclaimer of warranties. We are committed to adhering to their terms of service.

### Hololive Production

This is a fan-made application and is not affiliated with Hololive Production or COVER Corporation. All icons, talent names, and other related assets are the property of COVER Corporation. This application is created in accordance with COVER Corporation's derivative works guidelines.
