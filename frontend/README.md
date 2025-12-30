# Frontend - React + TypeScript + Vite

A modern, responsive personal website built with React, TypeScript, and Vite.

## Features

- **Home**: Landing page with introduction
- **Portfolio**: Showcase of projects and work
- **CV/Resume**: Professional experience and education
- **Contact**: Contact form for getting in touch

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Fast build tool and dev server
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client

## Getting Started

### Prerequisites

- Node.js 18+ (recommended: 20+)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
frontend/
├── src/
│   ├── components/     # Reusable components
│   ├── pages/          # Page components
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions (API, helpers)
│   ├── App.tsx         # Main app component with routing
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── public/             # Static assets
└── index.html          # HTML template
```

## API Integration

The frontend connects to the Flask backend API. Make sure the backend is running on `http://localhost:5000` or update the `VITE_API_URL` in your `.env` file.

## Deployment

Build the project:
```bash
npm run build
```

The `dist/` folder will contain the production-ready files that can be deployed to:
- Vercel
- Netlify
- GitHub Pages
- Any static hosting service

## Customization

1. Update personal information in the backend API responses
2. Modify colors in `tailwind.config.js`
3. Update page content in `src/pages/`
4. Add your own images to `public/`
