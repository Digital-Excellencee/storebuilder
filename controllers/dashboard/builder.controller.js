const { loadDB, listStoreBuilderPages, getStoreBuilderPageById, createStoreBuilderPage, saveStoreBuilderDraft, publishStoreBuilderPage, listPageSnapshots } = require('../../services/db');
const { BUILDER_SECTION_TYPES, createEmptySection, cloneBuilderValue } = require('../../helpers/builder-schema');
const { generateId } = require('../../helpers/html');

async function getVendorStore(req) {
  const db = await loadDB();
  const user = db && db.users ? db.users[String(req.apiUserEmail || '').trim().toLowerCase()] || null : null;
  const store = user && user.storeSlug && db && db.stores ? db.stores[user.storeSlug] || null : null;
  return { db, user, store };
}

async function withBuilderPage(req, res) {
  const { store } = await getVendorStore(req);
  if (!store) {
    res.status(404).json({ success: false, error: 'Store not found' });
    return null;
  }
  const page = await getStoreBuilderPageById(store.slug, req.params.id);
  if (!page) {
    res.status(404).json({ success: false, error: 'Builder page not found' });
    return null;
  }
  return { store, page };
}

async function mutateDraft(req, res, mutate) {
  const ctx = await withBuilderPage(req, res);
  if (!ctx) return;
  const draft = cloneBuilderValue(ctx.page.draftJson || {});
  const result = mutate(draft, ctx.store, ctx.page);
  if (result && result.error) {
    res.status(result.status || 400).json({ success: false, error: result.error });
    return;
  }
  const page = await saveStoreBuilderDraft(ctx.store.slug, ctx.page.id, draft);
  res.json({ success: true, page });
}

async function listBuilderPages(req, res) {
  try {
    const { store } = await getVendorStore(req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const pages = await listStoreBuilderPages(store.slug);
    res.json({ success: true, pages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function createBuilderPage(req, res) {
  try {
    const { store } = await getVendorStore(req);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    const page = await createStoreBuilderPage(store.slug, {
      pageKey: req.body.pageKey,
      title: req.body.title,
      slug: req.body.slug,
      pageType: 'builder',
      createdBy: req.apiUserId || req.apiUserEmail
    });
    res.status(201).json({ success: true, page });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

async function getBuilderPage(req, res) {
  try {
    const ctx = await withBuilderPage(req, res);
    if (!ctx) return;
    const snapshots = await listPageSnapshots(ctx.store.slug, ctx.page.id);
    res.json({
      success: true,
      page: ctx.page,
      snapshots: snapshots.map((snapshot) => ({
        id: snapshot.id,
        version: snapshot.version,
        createdAt: snapshot.createdAt,
        createdBy: snapshot.createdBy,
        note: snapshot.note
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function saveDraft(req, res) {
  try {
    const ctx = await withBuilderPage(req, res);
    if (!ctx) return;
    const draftJson = req.body && req.body.draftJson;
    if (!draftJson || typeof draftJson !== 'object' || Array.isArray(draftJson)) {
      return res.status(400).json({ success: false, error: 'draftJson object is required' });
    }
    const page = await saveStoreBuilderDraft(ctx.store.slug, ctx.page.id, draftJson);
    res.json({ success: true, page });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

async function publishPage(req, res) {
  try {
    const ctx = await withBuilderPage(req, res);
    if (!ctx) return;
    const published = await publishStoreBuilderPage(ctx.store.slug, ctx.page.id, req.apiUserId || req.apiUserEmail, req.body && req.body.note);
    res.json({ success: true, page: published.page, snapshot: published.snapshot });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

async function addSection(req, res) {
  try {
    const type = String(req.body.type || '').trim();
    if (!BUILDER_SECTION_TYPES.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid section type' });
    }
    await mutateDraft(req, res, (draft, store) => {
      draft.sections = Array.isArray(draft.sections) ? draft.sections : [];
      draft.sections.push(createEmptySection(type, store));
      return null;
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

async function moveSection(req, res) {
  try {
    const direction = String(req.body.direction || '').trim();
    if (!['up', 'down'].includes(direction)) {
      return res.status(400).json({ success: false, error: 'Invalid move direction' });
    }
    await mutateDraft(req, res, (draft) => {
      draft.sections = Array.isArray(draft.sections) ? draft.sections : [];
      const index = draft.sections.findIndex((section) => section.id === req.params.sectionId);
      if (index === -1) return { status: 404, error: 'Section not found' };
      if (direction === 'up' && index > 0) {
        const [section] = draft.sections.splice(index, 1);
        draft.sections.splice(index - 1, 0, section);
      }
      if (direction === 'down' && index < draft.sections.length - 1) {
        const [section] = draft.sections.splice(index, 1);
        draft.sections.splice(index + 1, 0, section);
      }
      return null;
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

async function duplicateSection(req, res) {
  try {
    await mutateDraft(req, res, (draft) => {
      draft.sections = Array.isArray(draft.sections) ? draft.sections : [];
      const index = draft.sections.findIndex((section) => section.id === req.params.sectionId);
      if (index === -1) return { status: 404, error: 'Section not found' };
      const duplicate = cloneBuilderValue(draft.sections[index]);
      duplicate.id = generateId('sec');
      draft.sections.splice(index + 1, 0, duplicate);
      return null;
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

async function deleteSection(req, res) {
  try {
    await mutateDraft(req, res, (draft) => {
      draft.sections = Array.isArray(draft.sections) ? draft.sections : [];
      const originalLength = draft.sections.length;
      draft.sections = draft.sections.filter((section) => section.id !== req.params.sectionId);
      if (draft.sections.length === originalLength) return { status: 404, error: 'Section not found' };
      return null;
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

module.exports = {
  listBuilderPages,
  createBuilderPage,
  getBuilderPage,
  saveDraft,
  publishPage,
  addSection,
  moveSection,
  duplicateSection,
  deleteSection
};
