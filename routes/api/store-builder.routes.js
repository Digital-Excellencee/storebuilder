const express = require('express');
const router = express.Router();
const builderController = require('../../controllers/store/builder.controller');

router.get('/:slug/builder/home', builderController.getPublishedHomePage);

module.exports = router;
