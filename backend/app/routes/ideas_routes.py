import sys
import traceback
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db
from app.dao import IdeaDAO

ideas_bp = Blueprint('ideas', __name__)


@ideas_bp.route('/ideas', methods=['GET'])
@jwt_required()
def getIdeas():
    try:
        ideas = IdeaDAO(db.session).getAll()
        return jsonify({'success': True, 'data': [i.toDict() for i in ideas]}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


@ideas_bp.route('/ideas', methods=['POST'])
@jwt_required()
def createIdea():
    data = request.get_json()
    title = (data.get('title') or '').strip() if data else ''
    description = (data.get('description') or '').strip() if data else ''
    if not title:
        return jsonify({'success': False, 'error': 'title is required'}), 400
    if not description:
        return jsonify({'success': False, 'error': 'description is required'}), 400
    if len(title) > 150:
        return jsonify({'success': False, 'error': 'title must be 150 characters or fewer'}), 400
    try:
        idea = IdeaDAO(db.session).create(title=title, description=description)
        return jsonify({'success': True, 'data': idea.toDict()}), 201
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


@ideas_bp.route('/ideas/<int:ideaId>', methods=['PUT'])
@jwt_required()
def updateIdea(ideaId):
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
    title = (data.get('title') or '').strip() or None
    description = (data.get('description') or '').strip() or None
    if title is not None and len(title) > 150:
        return jsonify({'success': False, 'error': 'title must be 150 characters or fewer'}), 400
    try:
        idea = IdeaDAO(db.session).update(ideaId, title=title, description=description)
        if not idea:
            return jsonify({'success': False, 'error': 'Idea not found'}), 404
        return jsonify({'success': True, 'data': idea.toDict()}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


@ideas_bp.route('/ideas/<int:ideaId>', methods=['DELETE'])
@jwt_required()
def deleteIdea(ideaId):
    try:
        deleted = IdeaDAO(db.session).delete(ideaId)
        if not deleted:
            return jsonify({'success': False, 'error': 'Idea not found'}), 404
        return jsonify({'success': True, 'message': 'Idea deleted'}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500
