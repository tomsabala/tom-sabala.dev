# Backend - Flask REST API

## Setup

1. Create a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Run the development server:
```bash
python run.py
```

The API will be available at `http://localhost:5000`

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/portfolio` - Get portfolio items
- `GET /api/cv` - Get CV/resume data
- `POST /api/contact` - Submit contact form

## Development

- API runs on port 5000 by default
- CORS is configured to accept requests from frontend (localhost:5173)
- Update `.env` file for configuration changes
