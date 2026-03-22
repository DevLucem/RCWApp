# RCWApp - A Simple, Fast, and Elegant REST API Testing Tool

[![Import to Firebase Studio](https://studio.firebase.google.com/static/images/studio-button-import.svg)](https://studio.firebase.google.com/import?url=https://github.com/devlucem/rcwapp)

RCWApp (RequestCall Web App) is a developer tool designed for testing REST API endpoints. It's built with modern web technologies to be fast, intuitive, and highly functional. It runs entirely in your browser and your data is stored locally, ensuring privacy and speed.

## ✨ Features

*   **Full REST Client**: Send `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS` requests.
*   **Tabbed Interface**: Manage multiple API requests simultaneously in separate tabs.
*   **Customizable Requests**: Easily configure request URLs, names, headers, and JSON body content.
*   **Detailed Response Viewer**: Inspect response status codes, headers, and view the response body in `Pretty`, `Raw`, or `Preview` (for HTML) formats.
*   **Persistent History**: Automatically saves a history of your requests for easy reuse.
*   **Workspace Management**: Organize your work with workspaces. You can create, rename, delete, and switch between multiple workspaces.
*   **Import & Export**:
    *   Export and import entire workspaces to share or backup your setups.
    *   Export and import request history for individual workspaces.
*   **Progressive Web App (PWA)**: Installable on your desktop or mobile device for a native-app experience and offline access.
*   **Theme Customization**: Switch between `Light`, `Dark`, and `System` themes to match your preference.
*   **Responsive Design**: A clean, responsive interface that works seamlessly across devices.
*   **Privacy Focused**: All request data, history, and workspaces are stored locally in your browser's storage.

## 🚀 Tech Stack

*   **Framework**: [Next.js](https://nextjs.org/) (App Router)
*   **UI Library**: [React](https://reactjs.org/) & [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **UI Components**: [ShadCN UI](https://ui.shadcn.com/)
*   **PWA**: `@ducanh2912/next-pwa`

## 🛠️ Local Setup Guide

Follow these steps to set up and run the project on your local machine.

### Prerequisites

*   [Node.js](https://nodejs.org/en/) (v18.x or later recommended)
*   [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation & Running the App

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/devlucem/rcwapp.git
    cd rcwapp
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```
    *or with yarn:*
    ```bash
    yarn install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    *or with yarn:*
    ```bash
    yarn dev
    ```

4.  **Open your browser:**
    Navigate to [http://localhost:9002](http://localhost:9002) to see the application running.

That's it! You're now ready to start making API requests.
