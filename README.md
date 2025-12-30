# tom-sabala.dev

Personal website showcasing portfolio, projects, CV, and contact information.

## Tech Stack

### Backend
- **Python 3.x** - Programming language
- **Flask** - Lightweight web framework
- **Flask-CORS** - Handle Cross-Origin Resource Sharing

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS
- **Axios** - HTTP client

## Project Structure

```
tom-sabala.dev/
├── backend/           # Flask REST API
│   ├── app/
│   │   ├── __init__.py
│   │   └── routes.py
│   ├── requirements.txt
│   ├── run.py
│   └── README.md
├── frontend/          # React application
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── types/
│   │   ├── utils/
│   │   └── App.tsx
│   ├── package.json
│   └── README.md
└── README.md
```

## Getting Started

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create and activate virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create `.env` file:
```bash
cp .env.example .env
```

5. Run the development server:
```bash
python run.py
```

Backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Start the development server:
```bash
npm run dev
```

Frontend will run on `http://localhost:5173`

## Running Both Servers

Open two terminal windows:

**Terminal 1 (Backend):**
```bash
cd backend
source venv/bin/activate
python run.py
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Then open `http://localhost:5173` in your browser.

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/portfolio` - Get portfolio items
- `GET /api/cv` - Get CV/resume data
- `POST /api/contact` - Submit contact form

## Features

- **Home Page**: Introduction and overview
- **Portfolio**: Showcase of projects with technologies, GitHub links, and live demos
- **CV/Resume**: Professional experience, education, and skills
- **Contact Form**: Get in touch with form submission
- **Responsive Design**: Mobile-friendly layout
- **Modern UI**: Clean design with Tailwind CSS

## Deployment

### Backend
- Deploy to: Heroku, Railway, Render, or any Python hosting
- Set environment variables in production
- Use production WSGI server (gunicorn)

### Frontend
- Deploy to: Vercel, Netlify, GitHub Pages
- Build: `npm run build`
- Update `VITE_API_URL` to production backend URL

## Customization

1. **Update Personal Info**: Edit backend API responses in `backend/app/routes.py`
2. **Add Projects**: Add portfolio items in the portfolio endpoint
3. **Update CV**: Modify CV data in the CV endpoint
4. **Styling**: Customize colors in `frontend/tailwind.config.js`
5. **Add Pages**: Create new components in `frontend/src/pages/`

## Next Steps

- [ ] Set up a database (PostgreSQL/MongoDB) for dynamic content
- [ ] Add authentication for admin panel
- [ ] Implement blog functionality with markdown support
- [ ] Add email service for contact form (SendGrid, Mailgun)
- [ ] Set up analytics (Google Analytics, Plausible)
- [ ] Add image optimization and CDN
- [ ] Implement SEO optimizations
- [ ] Add unit and integration tests

## License

MIT License - feel free to use this template for your own website!
