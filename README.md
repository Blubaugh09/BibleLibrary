# Bible Library

A React application for storing and retrieving various types of spiritual content with AI integration, Firebase storage, and Bible verse references.

## Features

- User authentication with Firebase
- AI chat with conversation history
- Bible verse integration using ESV API
- Audio conversion with OpenAI Whisper
- Multiple entry types (chat, links, video, text, etc.)
- Responsive design with Tailwind CSS

## Environment Setup

The application uses the following environment variables in the `.env` file:

```
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_firebase_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_firebase_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id

# OpenAI API Key
REACT_APP_OPENAI_API_KEY=your_openai_api_key

# ESV Bible API Key
REACT_APP_ESV_API_KEY=your_esv_api_key
```

## Installation

1. Clone the repository:
```
git clone <repository-url>
cd bible-library
```

2. Install dependencies:
```
npm install
```

3. Create a `.env` file in the root directory with your API keys.

4. Start the development server:
```
npm start
```

## Usage

1. Register or log in with your account
2. Create a new chat by clicking the "New Chat" button
3. Ask questions and receive responses with Bible verses
4. Your conversations will be automatically saved and converted to audio
5. Browse your saved entries in the library
6. Click on an entry to continue the conversation

## Technologies Used

- React with TypeScript
- Firebase (Authentication, Firestore, Storage)
- OpenAI GPT-3.5 Turbo and Whisper
- ESV Bible API
- Tailwind CSS
- React Router

## Future Implementations

The application includes blank components for additional entry types that can be implemented in the future:

- Link
- Video
- Text
- Audio
- Song
- Poem
- Quote
- Twitter
- YouTube
