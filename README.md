# SigmaGPT

SigmaGPT is a modern, full-stack AI-powered chat application designed for seamless and intuitive user experiences. It leverages a stateless backend and a local-first frontend architecture to provide fast, responsive, and privacy-focused chat interactions.

## Features

### Frontend
* **Local Storage Persistence**: Chats are stored locally in the browser, ensuring privacy and offline access.
* **Incognito Mode**: Chat without saving history.
* **AI-Generated Chat Titles**: Automatically generate and edit chat titles.
* **Responsive Design**: Mobile-first UI with drawer-style sidebar and sticky input areas.
* **Animations and Effects**: Smooth transitions, typewriter-style assistant replies, and skeleton loaders.
* **Import/Export**: Backup and restore chats via JSON files.

### Backend
* **Stateless API**: Proxy for AI responses and title generation.
* **Endpoints**:
    * `POST /api/chat/respond`: Generate AI responses.
    * `POST /api/chat/title`: Generate chat titles.
* **Simplified Architecture**: No database dependencies for maximum speed and privacy.

## Tech Stack

### Frontend
* **React**: Component-based UI development.
* **Vite**: Fast build tool for modern web apps.
* **CSS Modules**: Scoped and maintainable styles.

### Backend
* **Express.js**: Lightweight server framework.
* **OpenAI SDK**: AI response generation.

---

## Getting Started

### Prerequisites
* Node.js (v16 or higher)
* npm or yarn

### Installation
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/annu-creator24t/SigmaGPT.git
    cd SigmaGPT
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Development
1.  **Start the backend server:**
    ```bash
    cd Backend
    npm start
    ```
2.  **Start the frontend:**
    ```bash
    cd Frontend
    npm run dev
    ```
3.  **Open the app in your browser:**
    `http://localhost:5173`

### Environment Variables
Create `.env` files in the `Backend` and `Frontend` directories based on the provided `.env.example` files. Ensure you add your **OpenAI API Key** in the backend environment file.

---

## Contributing
1.  Fork the repository.
2.  Create a new branch: `git checkout -b feature/your-feature-name`.
3.  Commit your changes: `git commit -m "Add your message here"`.
4.  Push to the branch: `git push origin feature/your-feature-name`.
5.  Open a pull request.

## License
This project is licensed under the MIT License. See the LICENSE file for details.

## Acknowledgments
* **OpenAI** for the GPT model API.
* The open-source community for the modern web tools used in this project.