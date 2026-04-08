import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import DashboardFrame from '../../components/dashboard/DashboardFrame';
import Alert from '../../components/common/Alert';
import LoadingBlock from '../../components/common/LoadingBlock';
import EmptyState from '../../components/common/EmptyState';
import BuilderLayout from '../../components/builder/BuilderLayout';
import SectionLibrary from '../../components/builder/SectionLibrary';
import BuilderCanvas from '../../components/builder/BuilderCanvas';
import SectionSettingsPanel from '../../components/builder/SectionSettingsPanel';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { normalizeSchema } from '../../lib/builder-schema';

export default function BuilderHomePage() {
  const { vendor, bootstrapping } = useAuth();
  const token = vendor && vendor.token;
  const store = vendor && vendor.store ? vendor.store : { slug: '', name: 'Store', products: [], categories: [], themeConfig: {} };
  const [state, setState] = useState({ loading: true, saving: false, publishing: false, error: '', page: null, selectedId: '' });
  const [savedTick, setSavedTick] = useState(0);

  useEffect(() => {
    document.title = 'Website Builder - StoreBanao';
  }, []);

  async function hydrate() {
    if (!token) return;
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const list = await api.get('/api/dashboard/builder/pages', token);
      let homePage = (list.pages || []).find((page) => page.pageKey === 'home' || page.slug === 'home');
      if (!homePage) {
        const created = await api.post('/api/dashboard/builder/pages', { pageKey: 'home', title: 'Home', slug: 'home' }, token);
        homePage = created.page;
      }
      const detail = await api.get(`/api/dashboard/builder/pages/${homePage.id}`, token);
      const normalizedPage = { ...detail.page, draftJson: normalizeSchema(detail.page && detail.page.draftJson) };
      setState((prev) => ({ ...prev, loading: false, page: normalizedPage, selectedId: normalizedPage.draftJson.sections[0] ? normalizedPage.draftJson.sections[0].id : '', error: '' }));
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error.message || 'Unable to load builder page' }));
    }
  }

  useEffect(() => {
    hydrate();
  }, [token]);

  const sections = state.page && state.page.draftJson ? state.page.draftJson.sections || [] : [];
  const selectedSection = useMemo(() => sections.find((section) => section.id === state.selectedId) || sections[0] || null, [sections, state.selectedId]);

  function patchSelectedSection(patch) {
    setState((prev) => {
      if (!prev.page) return prev;
      const draftJson = normalizeSchema({
        ...prev.page.draftJson,
        sections: (prev.page.draftJson.sections || []).map((section) => section.id === (selectedSection && selectedSection.id) ? { ...section, settings: { ...section.settings, ...patch } } : section)
      });
      return { ...prev, page: { ...prev.page, draftJson } };
    });
  }

  async function saveDraft() {
    if (!state.page) return;
    setState((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      const response = await api.put(`/api/dashboard/builder/pages/${state.page.id}/draft`, { draftJson: state.page.draftJson }, token);
      setState((prev) => ({ ...prev, saving: false, page: { ...response.page, draftJson: normalizeSchema(response.page.draftJson) } }));
      setSavedTick(Date.now());
    } catch (error) {
      setState((prev) => ({ ...prev, saving: false, error: error.message || 'Unable to save draft' }));
    }
  }

  async function publish() {
    if (!state.page) return;
    setState((prev) => ({ ...prev, publishing: true, error: '' }));
    try {
      const response = await api.post(`/api/dashboard/builder/pages/${state.page.id}/publish`, { note: 'Published from React builder' }, token);
      setState((prev) => ({ ...prev, publishing: false, page: { ...response.page, draftJson: normalizeSchema(response.page.draftJson) } }));
      setSavedTick(Date.now());
    } catch (error) {
      setState((prev) => ({ ...prev, publishing: false, error: error.message || 'Unable to publish page' }));
    }
  }

  async function addSection(type) {
    if (!state.page) return;
    setState((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      const response = await api.post(`/api/dashboard/builder/pages/${state.page.id}/sections`, { type }, token);
      const nextPage = { ...response.page, draftJson: normalizeSchema(response.page.draftJson) };
      const lastSection = nextPage.draftJson.sections[nextPage.draftJson.sections.length - 1];
      setState((prev) => ({ ...prev, saving: false, page: nextPage, selectedId: lastSection ? lastSection.id : prev.selectedId }));
      setSavedTick(Date.now());
    } catch (error) {
      setState((prev) => ({ ...prev, saving: false, error: error.message || 'Unable to add section' }));
    }
  }

  async function moveSection(sectionId, direction) {
    if (!state.page) return;
    setState((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      const response = await api.post(`/api/dashboard/builder/pages/${state.page.id}/sections/${sectionId}/move`, { direction }, token);
      setState((prev) => ({ ...prev, saving: false, page: { ...response.page, draftJson: normalizeSchema(response.page.draftJson) } }));
      setSavedTick(Date.now());
    } catch (error) {
      setState((prev) => ({ ...prev, saving: false, error: error.message || 'Unable to move section' }));
    }
  }

  async function duplicateSection(sectionId) {
    if (!state.page) return;
    setState((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      const response = await api.post(`/api/dashboard/builder/pages/${state.page.id}/sections/${sectionId}/duplicate`, {}, token);
      const nextPage = { ...response.page, draftJson: normalizeSchema(response.page.draftJson) };
      const index = nextPage.draftJson.sections.findIndex((section) => section.id === sectionId);
      const duplicate = index >= 0 ? nextPage.draftJson.sections[index + 1] : null;
      setState((prev) => ({ ...prev, saving: false, page: nextPage, selectedId: duplicate ? duplicate.id : prev.selectedId }));
      setSavedTick(Date.now());
    } catch (error) {
      setState((prev) => ({ ...prev, saving: false, error: error.message || 'Unable to duplicate section' }));
    }
  }

  async function deleteSection(sectionId) {
    if (!state.page) return;
    if (!window.confirm('Delete this section?')) return;
    setState((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      const response = await api.del(`/api/dashboard/builder/pages/${state.page.id}/sections/${sectionId}`, token);
      const nextPage = { ...response.page, draftJson: normalizeSchema(response.page.draftJson) };
      setState((prev) => ({ ...prev, saving: false, page: nextPage, selectedId: nextPage.draftJson.sections[0] ? nextPage.draftJson.sections[0].id : '' }));
      setSavedTick(Date.now());
    } catch (error) {
      setState((prev) => ({ ...prev, saving: false, error: error.message || 'Unable to delete section' }));
    }
  }

  if (bootstrapping) return <LoadingBlock label="Loading builder..." />;
  if (!token) return <Navigate to="/login" replace />;

  return (
    <DashboardFrame
      activeKey="builder"
      title="Website Builder"
      subtitle="Builder V1 for your homepage: add sections, edit content, save draft, and publish."
      actions={<button className="btn" type="button" onClick={publish} disabled={state.publishing || !state.page}>{state.publishing ? 'Publishing...' : 'Publish Home'}</button>}
    >
      {state.error ? <Alert type="error">{state.error}</Alert> : null}
      {state.loading ? <LoadingBlock label="Loading builder..." /> : !state.page ? <EmptyState title="No builder page" body="We could not load your home page builder." /> : (
        <>
          <div className="builder-topbar-row">
            <div className="builder-topbar-copy">
              <strong>Page:</strong> {state.page.title} · <span>/store/{store.slug}</span>
            </div>
            <div className="builder-topbar-actions">
              <button className="btn btn-secondary" type="button" onClick={saveDraft} disabled={state.saving}>{state.saving ? 'Saving...' : 'Save Draft'}</button>
              <a className="btn btn-secondary" href={`/store/${store.slug}`} target="_blank" rel="noopener noreferrer">Open Live Store</a>
              {savedTick ? <span className="builder-inline-note success">Saved {new Date(savedTick).toLocaleTimeString()}</span> : null}
            </div>
          </div>
          <BuilderLayout
            sidebar={<SectionLibrary onAdd={addSection} disabled={state.saving || state.publishing} />}
            canvas={<section className="builder-panel"><div className="builder-panel-head"><h2>Canvas</h2><p>Click a section to edit it on the right.</p></div><BuilderCanvas sections={sections} selectedId={selectedSection && selectedSection.id} onSelect={(id) => setState((prev) => ({ ...prev, selectedId: id }))} onMove={moveSection} onDuplicate={duplicateSection} onDelete={deleteSection} store={store} products={(store.products || []).filter((product) => product.active !== false)} categories={store.categories || []} busy={state.saving || state.publishing} /></section>}
            settings={<SectionSettingsPanel section={selectedSection} onChange={patchSelectedSection} onSave={saveDraft} saveState={{ loading: state.saving, saved: !!savedTick }} />}
          />
        </>
      )}
    </DashboardFrame>
  );
}
