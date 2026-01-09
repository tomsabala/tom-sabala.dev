"""
Resume/CV routes - public viewing and admin update operations
"""
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.dao import ResumeDAO
from app.dao.resume_pdf_dao import ResumePdfDAO
from app.services.file_storage_service import FileStorageService
import os
import traceback
import sys

resume_bp = Blueprint('resume', __name__)


@resume_bp.route('/cv', methods=['GET'])
def getCv():
    """
    Get CV/Resume data (public endpoint)

    Returns:
        200: Resume data
        404: Resume not found
        500: Server error
    """
    try:
        resume = ResumeDAO.getResume()

        if not resume:
            return jsonify({
                'success': False,
                'error': 'No resume data found. Please run the seed script.'
            }), 404

        cvData = resume.toDict()

        return jsonify({
            'success': True,
            'data': cvData
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@resume_bp.route('/cv', methods=['PUT'])
@jwt_required()
def updateCv():
    """
    Update CV/resume data (admin only)

    Requires: Valid JWT access token

    Request body: Partial or complete resume data
        {
            "personalInfo": {...},
            "experience": [...],
            "education": [...],
            "skills": [...]
        }

    Returns:
        200: Resume updated successfully
        400: No data provided
        404: Resume not found
        500: Server error
    """
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400

    try:
        resume = ResumeDAO.getResume()
        if not resume:
            return jsonify({'success': False, 'error': 'Resume not found'}), 404

        updated = ResumeDAO.updateResume(
            resume.id,
            personalInfo=data.get('personalInfo'),
            experience=data.get('experience'),
            education=data.get('education'),
            skills=data.get('skills')
        )
        return jsonify({'success': True, 'data': updated.toDict()}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ========================================
# PDF RESUME ENDPOINTS
# ========================================

@resume_bp.route('/cv/pdf', methods=['GET'])
def getActivePdf():
    """
    Get currently active PDF resume metadata (public endpoint)

    Returns:
        200: PDF metadata (JSON)
        404: No active PDF found
        500: Server error
    """
    try:
        activePdf = ResumePdfDAO.getActivePdf()

        if not activePdf:
            return jsonify({
                'success': False,
                'error': 'No resume PDF available'
            }), 404

        return jsonify({
            'success': True,
            'data': activePdf.toDict()
        }), 200
    except Exception as e:
        # Print full traceback to stderr for Render logs
        print("ERROR in /cv/pdf:", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@resume_bp.route('/cv/pdf/file', methods=['GET'])
def getPdfFile():
    """
    Serve the active PDF resume file (public endpoint)
    Supports ?download=true query parameter to force download

    Query params:
        download (bool): If true, serves as attachment (forces download)

    Returns:
        200: PDF file (inline or download based on query param)
        404: No active PDF or file not found
        500: Server error
    """
    try:
        activePdf = ResumePdfDAO.getActivePdf()

        if not activePdf:
            return jsonify({
                'success': False,
                'error': 'No resume PDF available'
            }), 404

        # Get absolute file path
        filePath = FileStorageService.getFilePath(activePdf.filePath)

        if not os.path.exists(filePath):
            return jsonify({
                'success': False,
                'error': 'PDF file not found on server'
            }), 404

        # Check if download is requested via query parameter
        download = request.args.get('download', 'false').lower() == 'true'

        # Send file inline or as attachment based on query parameter
        return send_file(
            filePath,
            mimetype='application/pdf',
            as_attachment=download,  # True forces download, False shows inline
            download_name=activePdf.fileName
        )
    except Exception as e:
        # Print full traceback to stderr for Render logs
        print("ERROR in /cv/pdf/file:", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@resume_bp.route('/cv/pdf/upload', methods=['POST'])
@jwt_required()
def uploadPdf():
    """
    Upload new PDF resume (admin only)
    Automatically sets as active version and deactivates others

    Requires: Valid JWT access token

    Form data:
        file: PDF file (max 10MB)

    Returns:
        201: Upload successful with PDF metadata
        400: Validation error (no file, wrong type, too large)
        500: Server error
    """
    # Debug: Log that we got past JWT verification
    print(f"DEBUG: uploadPdf - JWT verification passed, user ID: {get_jwt_identity()}", file=sys.stderr)

    # Check if file in request
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file provided'}), 400

    file = request.files['file']

    # Validate file
    isValid, errorMsg = FileStorageService.validateFile(file)
    if not isValid:
        return jsonify({'success': False, 'error': errorMsg}), 400

    try:
        # Get current user ID
        userId = get_jwt_identity()

        # Save file to storage
        originalFilename, relativePath, fileSize = FileStorageService.saveFile(file)

        # Create database record (auto-activates, deactivates others)
        newVersion = ResumePdfDAO.createVersion(
            fileName=originalFilename,
            filePath=relativePath,
            fileSize=fileSize,
            userId=userId
        )

        return jsonify({
            'success': True,
            'message': 'PDF uploaded successfully',
            'data': newVersion.toDict()
        }), 201
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@resume_bp.route('/cv/pdf/history', methods=['GET'])
@jwt_required()
def getPdfHistory():
    """
    Get all PDF version history (admin only)

    Requires: Valid JWT access token

    Query params:
        includeDeleted (bool): Include soft-deleted versions (default: false)

    Returns:
        200: List of all PDF versions (newest first)
        500: Server error
    """
    try:
        includeDeleted = request.args.get('includeDeleted', 'false').lower() == 'true'
        versions = ResumePdfDAO.getAllVersions(includeDeleted=includeDeleted)

        return jsonify({
            'success': True,
            'data': [v.toDict() for v in versions]
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@resume_bp.route('/cv/pdf/<int:versionId>/activate', methods=['PUT'])
@jwt_required()
def activatePdfVersion(versionId):
    """
    Set a specific PDF version as active - restore from history (admin only)
    Deactivates all other versions

    Requires: Valid JWT access token

    Args:
        versionId (int): Version ID to activate

    Returns:
        200: Version activated successfully
        404: Version not found or deleted
        500: Server error
    """
    try:
        version = ResumePdfDAO.setActiveVersion(versionId)

        if not version:
            return jsonify({
                'success': False,
                'error': 'Version not found or deleted'
            }), 404

        return jsonify({
            'success': True,
            'message': 'Version activated successfully',
            'data': version.toDict()
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@resume_bp.route('/cv/pdf/<int:versionId>', methods=['DELETE'])
@jwt_required()
def deletePdfVersion(versionId):
    """
    Soft delete a PDF version (admin only)
    File remains in history but marked as deleted

    Requires: Valid JWT access token

    Args:
        versionId (int): Version ID to delete

    Returns:
        200: Version deleted successfully
        404: Version not found
        500: Server error
    """
    try:
        success = ResumePdfDAO.softDelete(versionId)

        if not success:
            return jsonify({
                'success': False,
                'error': 'Version not found'
            }), 404

        return jsonify({
            'success': True,
            'message': 'Version deleted successfully'
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
