import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth';
import DashboardFrame from '../../components/dashboard/DashboardFrame';
import Alert from '../../components/common/Alert';
import LoadingBlock from '../../components/common/LoadingBlock';
import EmptyState from '../../components/common/EmptyState';

export default function PagesPage() {
  const { vendor, bootstrapping } = useAuth();
  const token = vendor && vendor.token;
  const storeSlug = vendor && vendor.store ? vendor.store.slug : '';
  const [form, setForm] = useState({ title: '', slug: '', content: '', active: true });
  const [state, setState] = useState({ loading: true, error: '', pages: [] });

  async function loadPages() {
    if (!token) return;
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const data = await api.get('/api/dashboard/pages', token);
      setState({ loading: false, error: '', pages: data.pages || [] });
    } catch (error) {
      setState({ loading: false, error: error.message || 'Unable to load pages', pages: [] });
    }
  }

  useEffect(() => {
    loadPages();
  }, [token]);

  async function add(event) {
    event.preventDefault();
    await api.post('/api/dashboard/pages', form, token);
    setForm({ title: '', slug: '', content: '', active: true });
    loadPages();
  }

  async function remove(id) {
    await api.del(`/api/dashboard/pages/${id}`, token);
    loadPages();
  }

  if (bootstrapping) return <LoadingBlock label="Loading dashboard..." />;
  if (!token) return <Navigate to="/login" replace />;

  return (
    <DashboardFrame activeKey="pages" title="Pages" subtitle="Manage simple content pages and jump into the home page builder.">
      {state.error ? <Alert type="error">{state.error}</Alert> : null}
      <div className="osa-page-head">
        <div>
          <h1>Content Pages</h1>
          <p>Keep About, Contact, Shipping, Return Policy, and other text pages here. Use Website Builder for the homepage.</p>
        </div>
        <div className="actions"><Link className="btn" to="/dashboard/builder/home">Open Website Builder</Link></div>
      </div>
      <section className="osa-card osa-page-card">
        <form className="osa-form-grid" onSubmit={add}>
          <div className="osa-form-grid two">
            <div className="osa-field"><label>Page title</label><input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} required /></div>
            <div className="osa-field"><label>Page slug</label><input value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} required /></div>
            <div className="osa-field"><label>Content</label><textarea value={form.content} onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))} /></div>
            <div className="osa-field"><label>Publish</label><select value={form.active ? 'yes' : 'no'} onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.value === 'yes' }))}><option value="yes">Yes</option><option value="no">No</option></select></div>
          </div>
          <div className="osa-actions"><button className="osa-btn" type="submit">Add page</button></div>
        </form>
        {state.loading ? <LoadingBlock label="Loading pages..." /> : state.pages.length ? (
          <div className="table-wrap" style={{ marginTop: 18 }}>
            <table>
              <thead><tr><th>Page</th><th>Slug</th><th>Status</th><th>Preview</th><th>Delete</th></tr></thead>
              <tbody>
                {state.pages.map((page) => (
                  <tr key={page.id}>
                    <td>{page.title}</td>
                    <td>{page.slug}</td>
                    <td>{page.active ? 'Published' : 'Draft'}</td>
                    <td>{page.active && storeSlug ? <a className="btn btn-secondary" href={`/store/${storeSlug}/page/${page.slug}`}>Preview</a> : '-'}</td>
                    <td><button className="btn btn-danger" type="button" onClick={() => remove(page.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No pages yet" body="Create your first content page, or open Website Builder for the homepage." />}
      </section>
    </DashboardFrame>
  );
}
