const express = require('express');
const router = express.Router();
const { requireApiAuth } = require('../../middleware/api-auth');
const builderController = require('../../controllers/dashboard/builder.controller');

router.get('/pages', requireApiAuth, builderController.listBuilderPages);
router.post('/pages', requireApiAuth, builderController.createBuilderPage);
router.get('/pages/:id', requireApiAuth, builderController.getBuilderPage);
router.put('/pages/:id/draft', requireApiAuth, builderController.saveDraft);
router.post('/pages/:id/publish', requireApiAuth, builderController.publishPage);
router.post('/pages/:id/sections', requireApiAuth, builderController.addSection);
router.delete('/pages/:id/sections/:sectionId', requireApiAuth, builderController.deleteSection);
router.post('/pages/:id/sections/:sectionId/move', requireApiAuth, builderController.moveSection);
router.post('/pages/:id/sections/:sectionId/duplicate', requireApiAuth, builderController.duplicateSection);

module.exports = router;
