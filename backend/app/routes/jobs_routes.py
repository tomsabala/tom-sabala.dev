import sys
import json
import os
import traceback
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db, limiter
from app.dao import CompanyDAO, JobApplicationDAO
from app.models.job_application import VALID_STATUSES

jobs_bp = Blueprint('jobs', __name__)


# ── Companies ─────────────────────────────────────────────────────────────────

@jobs_bp.route('/jobs/companies/suggest-categories', methods=['POST'])
@jwt_required()
@limiter.limit("20 per hour")
def suggestCategories():
    apiKey = os.getenv('ANTHROPIC_API_KEY')
    if not apiKey:
        return jsonify({'success': False, 'error': 'AI suggestions unavailable'}), 503

    data = request.get_json() or {}
    name = data.get('name', '').strip()
    url = data.get('url', '').strip()
    notes = data.get('notes', '').strip()

    userMsg = f"Company: {name}"
    if url:
        userMsg += f"\nURL: {url}"
    if notes:
        userMsg += f"\nNotes: {notes}"

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=apiKey)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=100,
            temperature=0,
            system=(
                "You are a job tracker assistant that classifies companies for a job seeker. "
                "Given a company name, website URL, and optional notes, return ONLY a JSON array "
                "of exactly 2 to 3 concise lowercase tags that best describe the company's core industry "
                "or technology domain. Prioritise specificity over breadth — pick the most identifying tags. "
                "Use single words or hyphenated phrases (e.g. 'robotics', 'fintech', 'cloud-infrastructure', "
                "'autonomous-vehicles', 'defense', 'saas', 'biotech'). "
                "Do NOT include generic tags like 'technology', 'software', 'company', 'startup'. "
                "Output ONLY the raw JSON array with no explanation, no markdown, no code fences."
            ),
            messages=[
                {"role": "user", "content": userMsg},
                {"role": "assistant", "content": "["},
            ],
        )
        raw = "[" + message.content[0].text.strip()
        # Strip markdown code fences if model wraps anyway
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        categories = json.loads(raw)
        if not isinstance(categories, list):
            categories = []
    except json.JSONDecodeError as e:
        print(f"suggestCategories: JSON parse error on response: {str(e)}", file=sys.stderr)
        return jsonify({'success': True, 'categories': [], 'warning': 'AI suggestion failed, try again'}), 200
    except Exception as e:
        print(f"suggestCategories error: {str(e)}", file=sys.stderr)
        return jsonify({'success': True, 'categories': [], 'warning': 'AI suggestion failed, try again'}), 200

    return jsonify({'success': True, 'categories': categories}), 200


@jobs_bp.route('/jobs/companies', methods=['GET'])
@jwt_required()
def getCompanies():
    try:
        companies = CompanyDAO(db.session).getAll()
        return jsonify({'success': True, 'data': [c.toDict() for c in companies]}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


@jobs_bp.route('/jobs/companies', methods=['POST'])
@jwt_required()
def createCompany():
    data = request.get_json()
    if not data or not data.get('name', '').strip():
        return jsonify({'success': False, 'error': 'name is required'}), 400
    try:
        rawCategories = data.get('categories')
        company = CompanyDAO(db.session).create(
            name=data['name'].strip(),
            url=data.get('url', '').strip() or None,
            notes=data.get('notes', '').strip() or None,
            categories=rawCategories if isinstance(rawCategories, list) else [],
        )
        return jsonify({'success': True, 'data': company.toDict()}), 201
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


@jobs_bp.route('/jobs/companies/<int:companyId>', methods=['PUT'])
@jwt_required()
def updateCompany(companyId):
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
    try:
        rawCategories = data.get('categories')
        company = CompanyDAO(db.session).update(
            companyId,
            name=data.get('name', '').strip() or None,
            url=data.get('url', '').strip() or None,
            notes=data.get('notes', '').strip() or None,
            categories=rawCategories if isinstance(rawCategories, list) else [],
        )
        if not company:
            return jsonify({'success': False, 'error': 'Company not found'}), 404
        return jsonify({'success': True, 'data': company.toDict()}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


@jobs_bp.route('/jobs/companies/<int:companyId>', methods=['DELETE'])
@jwt_required()
def deleteCompany(companyId):
    try:
        deleted = CompanyDAO(db.session).delete(companyId)
        if not deleted:
            return jsonify({'success': False, 'error': 'Company not found'}), 404
        return jsonify({'success': True, 'message': 'Company deleted'}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


# ── Applications ──────────────────────────────────────────────────────────────

@jobs_bp.route('/jobs/applications', methods=['GET'])
@jwt_required()
def getApplications():
    try:
        status = request.args.get('status')
        if status and status not in VALID_STATUSES:
            return jsonify({'success': False, 'error': f'Invalid status. Must be one of: {VALID_STATUSES}'}), 400
        applications = JobApplicationDAO(db.session).getAll(status=status)
        return jsonify({'success': True, 'data': [a.toDict() for a in applications]}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


@jobs_bp.route('/jobs/applications', methods=['POST'])
@jwt_required()
def createApplication():
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400

    companyName = data.get('company_name', '').strip()
    position = data.get('position', '').strip()
    status = data.get('status', 'bookmarked')

    if not companyName:
        return jsonify({'success': False, 'error': 'company_name is required'}), 400
    if not position:
        return jsonify({'success': False, 'error': 'position is required'}), 400
    if status not in VALID_STATUSES:
        return jsonify({'success': False, 'error': f'Invalid status. Must be one of: {VALID_STATUSES}'}), 400

    dateApplied = None
    rawDate = data.get('date_applied')
    if rawDate:
        try:
            dateApplied = datetime.strptime(rawDate, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'success': False, 'error': 'date_applied must be YYYY-MM-DD'}), 400

    try:
        application = JobApplicationDAO(db.session).create(
            companyName=companyName,
            position=position,
            status=status,
            companyId=data.get('company_id'),
            jobUrl=data.get('job_url', '').strip() or None,
            dateApplied=dateApplied,
            notes=data.get('notes', '').strip() or None,
        )
        return jsonify({'success': True, 'data': application.toDict()}), 201
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


@jobs_bp.route('/jobs/applications/<int:applicationId>', methods=['PUT'])
@jwt_required()
def updateApplication(applicationId):
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400

    companyName = data.get('company_name', '').strip()
    position = data.get('position', '').strip()
    status = data.get('status')

    if not companyName:
        return jsonify({'success': False, 'error': 'company_name is required'}), 400
    if not position:
        return jsonify({'success': False, 'error': 'position is required'}), 400
    if status and status not in VALID_STATUSES:
        return jsonify({'success': False, 'error': f'Invalid status. Must be one of: {VALID_STATUSES}'}), 400

    dateApplied = None
    rawDate = data.get('date_applied')
    if rawDate:
        try:
            dateApplied = datetime.strptime(rawDate, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'success': False, 'error': 'date_applied must be YYYY-MM-DD'}), 400

    try:
        application = JobApplicationDAO(db.session).update(
            applicationId,
            companyName=companyName,
            position=position,
            status=status or 'bookmarked',
            companyId=data.get('company_id'),
            jobUrl=data.get('job_url', '').strip() or None,
            dateApplied=dateApplied,
            notes=data.get('notes', '').strip() or None,
        )
        if not application:
            return jsonify({'success': False, 'error': 'Application not found'}), 404
        return jsonify({'success': True, 'data': application.toDict()}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


@jobs_bp.route('/jobs/applications/<int:applicationId>/status', methods=['PATCH'])
@jwt_required()
def updateApplicationStatus(applicationId):
    data = request.get_json()
    status = data.get('status') if data else None
    if not status:
        return jsonify({'success': False, 'error': 'status is required'}), 400
    if status not in VALID_STATUSES:
        return jsonify({'success': False, 'error': f'Invalid status. Must be one of: {VALID_STATUSES}'}), 400
    try:
        application = JobApplicationDAO(db.session).update(applicationId, status=status)
        if not application:
            return jsonify({'success': False, 'error': 'Application not found'}), 404
        return jsonify({'success': True, 'data': application.toDict()}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


@jobs_bp.route('/jobs/applications/<int:applicationId>', methods=['DELETE'])
@jwt_required()
def deleteApplication(applicationId):
    try:
        deleted = JobApplicationDAO(db.session).delete(applicationId)
        if not deleted:
            return jsonify({'success': False, 'error': 'Application not found'}), 404
        return jsonify({'success': True, 'message': 'Application deleted'}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500
