import React from 'react';
import App from './App';

export default function EtcdBrowserPlugin() {
  return (
    <App
      isPlugin={true}
      apiBase="/api/proxy/plugin/etcd-v3-browser/backend"
      fetchFn={fetch}
    />
  );
}
