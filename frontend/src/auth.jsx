import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);
const CUSTOMER_KEY = 'storebanao_customer_auth';
const VENDOR_KEY = 'storebanao_vendor_auth';
const SUPERADMIN_KEY = 'storebanao_superadmin_auth';

function readStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch (error) {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [vendor, setVendor] = useState(() => readStorage(VENDOR_KEY));
  const [customer, setCustomer] = useState(() => readStorage(CUSTOMER_KEY));
  const [superAdmin, setSuperAdmin] = useState(() => readStorage(SUPERADMIN_KEY));
  const [bootstrapping, setBootstrapping] = useState(() => {
    const hasStoredVendor = !!readStorage(VENDOR_KEY);
    const hasStoredCustomer = !!readStorage(CUSTOMER_KEY);
    const hasStoredSuperAdmin = !!readStorage(SUPERADMIN_KEY);
    return !(hasStoredVendor || hasStoredCustomer || hasStoredSuperAdmin);
  });

  useEffect(() => {
    if (vendor) localStorage.setItem(VENDOR_KEY, JSON.stringify(vendor));
    else localStorage.removeItem(VENDOR_KEY);
  }, [vendor]);

  useEffect(() => {
    if (customer) localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
    else localStorage.removeItem(CUSTOMER_KEY);
  }, [customer]);

  useEffect(() => {
    if (superAdmin) localStorage.setItem(SUPERADMIN_KEY, JSON.stringify(superAdmin));
    else localStorage.removeItem(SUPERADMIN_KEY);
  }, [superAdmin]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      if (!cancelled) setBootstrapping(false);
      try {
        const vendorAuth = readStorage(VENDOR_KEY);
        if (vendorAuth && vendorAuth.token) {
          try {
            const data = await api.get('/api/auth/me', vendorAuth.token);
            if (!cancelled) {
              setVendor({ token: vendorAuth.token, user: data.user, store: data.store });
            }
          } catch (error) {
            if (!cancelled) setVendor(null);
          }
        }
        const customerAuth = readStorage(CUSTOMER_KEY);
        if (customerAuth && customerAuth.token && customerAuth.slug) {
          try {
            const data = await api.get(`/api/store/${customerAuth.slug}/auth/me`, customerAuth.token);
            if (!cancelled) {
              setCustomer({ token: customerAuth.token, slug: customerAuth.slug, customer: data.customer });
            }
          } catch (error) {
            if (!cancelled) setCustomer(null);
          }
        }
      } finally {
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({
    vendor,
    customer,
    superAdmin,
    bootstrapping,
    async loginVendor(payload) {
      const data = await api.post('/api/auth/login', payload);
      const next = { token: data.token, user: data.user, store: data.store };
      setVendor(next);
      return data;
    },
    async registerVendor(payload) {
      const data = await api.post('/api/auth/register', payload);
      const next = { token: data.token, user: data.user, store: data.store };
      setVendor(next);
      return data;
    },
    logoutVendor() { setVendor(null); },
    async loginCustomer(slug, payload) {
      const data = await api.post(`/api/store/${slug}/auth/login`, payload);
      setCustomer({ token: data.token, slug, customer: data.customer });
      return data;
    },
    async registerCustomer(slug, payload) {
      const data = await api.post(`/api/store/${slug}/auth/register`, payload);
      setCustomer({ token: data.token, slug, customer: data.customer });
      return data;
    },
    async refreshCustomer(slug, tokenOverride) {
      const activeSlug = slug || (customer && customer.slug);
      const token = tokenOverride || (customer && customer.token);
      if (!activeSlug || !token) return null;
      const data = await api.get(`/api/store/${activeSlug}/auth/me`, token);
      setCustomer({ token, slug: activeSlug, customer: data.customer });
      return data;
    },
    logoutCustomer() { setCustomer(null); },
    async loginSuperAdmin(payload) {
      const data = await api.post('/api/superadmin/login', payload);
      const next = { token: data.token };
      setSuperAdmin(next);
      return data;
    },
    logoutSuperAdmin() { setSuperAdmin(null); }
  }), [vendor, customer, superAdmin, bootstrapping]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
