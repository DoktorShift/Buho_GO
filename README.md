# Buho Go

Buho Go is a mobile-optimized web app designed to work seamlessly with Nostr Wallet Connect. It enables multi-connections, allowing you to connect to multiple NWC wallets or even nodes.

## Features

- **Nostr Wallet Connect:** Connect to multiple NWC wallets or nodes.
- **Mobile Optimized:** Enjoy a responsive and streamlined experience on mobile devices.
- **Multi Connections:** Easily manage and switch between several wallet connections.

## Roadmap & Improvements

- **Backend:** Developing a more robust and proper backend.
- **Transaction Timestamps:** Adding logic to include timestamps when listing transactions.
- **Payment Security:** Enabling a PIN for payments that exceed a defined amount.
- **Frontend Enhancements:** Continued cleanup and improvements to the user interface.

## Installation

1. **Install Dependencies:**

   ```bash
   npm install
   ```

2. **Build the Project:**

   ```bash
   npm run build
   ```

3. **Run the Application:**

   Use [PM2](https://pm2.keymetrics.io/) to manage the process and [Caddy](https://caddyserver.com/) as the web server.

   ```bash
   pm2 start
   # Configure Caddy as needed for serving the app.
   ```

## Contributing

Use Buho Go, contribute back to the project, and help us improve the experience for everyone!

## Acknowledgments

Special thanks to [Supertestnet](https://github.com/supertestnet/nwcjs) for open source the code which this app is build on. 
