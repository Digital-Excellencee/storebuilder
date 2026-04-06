const express = require('express');
const router = express.Router();

router.use('/', require('./auth.routes'));
router.use('/store', require('./store.routes'));
router.use('/', require('./dashboard.routes'));
router.use('/', require('./superadmin.routes'));

module.exports = router;
