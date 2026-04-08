const express = require('express');
const router = express.Router();
const { requireApiAuth } = require('../../middleware/api-auth');
const pagesController = require('../../controllers/dashboard/pages.controller');

router.get('/', requireApiAuth, pagesController.listPages);
router.post('/', requireApiAuth, pagesController.createPage);
router.delete('/:id', requireApiAuth, pagesController.deletePage);

module.exports = router;
