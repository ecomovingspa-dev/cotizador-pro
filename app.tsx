import React, { useState, useMemo, useEffect, useRef } from 'react';

// ============================================================================
// ⚙️ CONFIGURACIÓN DE INFRAESTRUCTURA (GOOGLE SHEETS DATABASE)
// ============================================================================

const API_KEY = 'AIzaSyCShAoumSMfgaSHfx07Gc9eOJWNUev8IsE';
const CLIENT_ID = '367886195210-kcoq4srkcsei95mbs9rimg4dg1le93l7.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets email profile openid';
const DISCOVERY_DOCS = ['https://sheets.googleapis.com/$discovery/rest?version=v4'];

// Mapa de Archivos (IDs extraídos de evidencia visual)
const DB = {
  QUOTES:   { id: '1pU9mnO7NXHFp9PUVP4O548SO79KkJrFbNvRHSppv9-8', sheet: 'Maestro_Cotizaciones' },
  ITEMS:    { id: '1scu3ndKCAUqKKlZBEWiYUyWYghtQIBgmTknw5A4zqTo', sheet: 'Maestro_Items' },
  COSTS:    { id: '1DjUKP0vNgqPWs0FN94GW1GndnU1a9NaolKsZxLsBZ4Y', sheet: 'Maestro_Costos' },
  CLIENTS:  { id: '1jpAhYMnc7xdZ22Wh6SoC9ygTb1lIRA6AAchvmk691Z0', sheet: 'Maestro_Cuentas' },
  CONTACTS: { id: '1V0FRA2gro7yPwPXDPEA8oq1H9oivlNQ0FrLJnL8qAIA', sheet: 'Maestro_Contactos' }
};

// ============================================================================
// 📦 DEFINICIÓN DE TIPOS (TYPESCRIPT)
// ============================================================================

declare global { interface Window { gapi: any; google: any; } }

interface User { id: string; name: string; email: string; avatar: string; }
interface Client { id: string; name: string; sector: string; marketId: string; } // Simplificado para selectores
interface Contact { id: string; name: string; email: string; clientId: string; } 

interface QuoteItem { id: string; quoteId: string; itemNumber: number; image: string; quantity: number; description: string; unitPrice: number; }
interface QuoteCost { id: string; quoteId: string; itemNumber: number; code: string; provider: string; quantity: number; unitCost: number; discountPercent: number; }
interface QuoteDocs { oc: string; guia: string; factura: string; }
type QuoteStatus = 'Pendiente' | 'Producción' | 'Despachada' | 'Facturada' | 'Perdida';

// ============================================================================
// 🧩 COMPONENTES UI REUTILIZABLES
// ============================================================================

const EditableInput = ({ value, onChange, type = "text", className = "", align = "left", readOnly = false, placeholder = "" }: any) => (
  <input 
    type={type} value={value} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} placeholder={placeholder}
    className={`w-full bg-transparent border-b border-transparent outline-none px-2 py-1 text-slate-200 placeholder-slate-500 text-${align} ${className} ${readOnly ? 'cursor-default text-slate-400' : 'hover:border-slate-600 focus:border-indigo-500 focus:bg-slate-800/50 transition-all'}`} 
  />
);

const getStatusColor = (status: QuoteStatus) => {
  const colors: Record<string, string> = {
    'Producción': 'bg-amber-500/20 text-amber-400 border-amber-500/50',
    'Despachada': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    'Facturada': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
    'Perdida': 'bg-red-500/20 text-red-400 border-red-500/50',
  };
  return colors[status] || 'bg-slate-700 text-slate-300 border-slate-600';
};

// Helper: Convierte Objeto a Array respetando orden de columnas
const toRow = (obj: any, keys: string[]) => keys.map(k => obj[k] ?? '');

// ============================================================================
// 🚀 APLICACIÓN PRINCIPAL
// ============================================================================

export default function App() {
  // --- Estado de Sesión ---
  const [user, setUser] = useState<User | null>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);

  // --- Estado de Datos (Catálogos) ---
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [contactsList, setContactsList] = useState<Contact[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // --- Estado de la Cotización Actual ---
  const [quoteId, setQuoteId] = useState('COT-4738');
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>('Pendiente');
  const [docs, setDocs] = useState<QuoteDocs>({ oc: '', guia: '', factura: '' });
  const [clientInfo, setClientInfo] = useState({ clientId: '', clientName: '', contactId: '', contactName: '', marketId: '' });
  const [execInfo, setExecInfo] = useState({ name: '', email: '' });
  
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [costs, setCosts] = useState<QuoteCost[]>([]);
  
  // --- Estado UI ---
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempStatus, setTempStatus] = useState<QuoteStatus>('Pendiente');
  const [tempDocs, setTempDocs] = useState<QuoteDocs>({ oc: '', guia: '', factura: '' });
  
  // Inputs temporales para agregar filas
  const [newItem, setNewItem] = useState<Partial<QuoteItem>>({ quantity: 1, unitPrice: 0, description: '' });
  const [newCost, setNewCost] = useState<Partial<QuoteCost>>({ quantity: 1, unitCost: 0, discountPercent: 0, provider: '', code: '', itemNumber: 1 });

  // --------------------------------------------------------------------------
  // 1. INICIALIZACIÓN Y AUTENTICACIÓN (GIS + GAPI)
  // --------------------------------------------------------------------------
  
  useEffect(() => {
    const initGoogle = () => {
      if (window.google && window.gapi) {
        // Configurar Login
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID, scope: SCOPES,
          callback: async (resp: any) => {
            if (resp.access_token) {
              window.gapi.client.setToken(resp);
              await loadUserProfile(resp.access_token);
              await loadCatalogs(); // Cargar catálogos al entrar
            }
          }
        });
        setTokenClient(client);
        
        // Configurar Sheets API
        window.gapi.load('client', async () => {
          await window.gapi.client.init({ apiKey: API_KEY, discoveryDocs: DISCOVERY_DOCS });
          setIsReady(true);
        });
      }
    };
    setTimeout(initGoogle, 800);
  }, []);

  const loadUserProfile = async (token: string) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setUser({ id: data.sub, name: data.name, email: data.email, avatar: data.picture });
      setExecInfo({ name: data.name, email: data.email });
    } catch (e) { console.error("Error perfil:", e); }
  };

  const handleLogin = () => tokenClient?.requestAccessToken();
  const handleLogout = () => {
    const token = window.gapi.client.getToken();
    if (token) window.google.accounts.oauth2.revoke(token.access_token, () => {
      window.gapi.client.setToken(null); setUser(null);
    });
  };

  // --------------------------------------------------------------------------
  // 2. LECTURA DE DATOS (CATÁLOGOS)
  // --------------------------------------------------------------------------

  const loadCatalogs = async () => {
    setIsLoadingData(true);
    try {
      // Leer Clientes (Rango estimado A2:F)
      const clRes = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: DB.CLIENTS.id, range: `${DB.CLIENTS.sheet}!A2:F`
      });
      const rawClients = clRes.result.values || [];
      setClientsList(rawClients.map((r: any, i: number) => ({
        id: r[0] || `c-${i}`, name: r[0] || 'Sin Nombre', sector: r[1] || '', marketId: r[2] || '' 
        // Nota: Ajustar índices [0],[1] según orden real de columnas en tu sheet
      })));

      // Leer Contactos
      const ctRes = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: DB.CONTACTS.id, range: `${DB.CONTACTS.sheet}!A2:E`
      });
      setContactsList((ctRes.result.values || []).map((r: any, i: number) => ({
        id: `ct-${i}`, email: r[0] || '', name: r[1] || '', clientId: '' // Asumiendo col 0 es email, 1 nombre
      })));

    } catch (e) { console.error("Error cargando catálogos:", e); }
    setIsLoadingData(false);
  };

  // --------------------------------------------------------------------------
  // 3. CÁLCULOS Y LÓGICA DE NEGOCIO
  // --------------------------------------------------------------------------

  const financials = useMemo(() => {
    let rev = 0, cost = 0;
    items.forEach(i => {
      rev += i.quantity * i.unitPrice;
      const relCosts = costs.filter(c => c.itemNumber === i.itemNumber);
      cost += relCosts.reduce((acc, c) => acc + (c.quantity * c.unitCost * (1 - c.discountPercent/100)), 0);
    });
    const net = rev;
    const tax = Math.round(net * 0.19);
    return { revenue: net, cost, margin: net - cost, marginPct: net > 0 ? (net - cost)/net : 0, tax, total: net + tax };
  }, [items, costs]);

  const formatMoney = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n);

  // --------------------------------------------------------------------------
  // 4. GUARDADO INTELIGENTE (UPSERT: ACTUALIZAR O CREAR)
  // --------------------------------------------------------------------------

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    const now = new Date().toISOString();

    try {
      // A. Preparar Fila Maestra
      const COLS_MASTER = ['id','createdAt','clientId','clientName','contactName','marketId','execName','execEmail','status','oc','guia','factura','net','tax','total','cost','marginPct'];
      const masterObj = {
        id: quoteId, createdAt: now, clientId: clientInfo.clientId, clientName: clientInfo.clientName,
        contactName: clientInfo.contactName, marketId: clientInfo.marketId, execName: execInfo.name,
        execEmail: execInfo.email, status: quoteStatus, oc: docs.oc, guia: docs.guia, factura: docs.factura,
        net: financials.revenue, tax: financials.tax, total: financials.total, cost: financials.cost, 
        marginPct: financials.marginPct.toFixed(2)
      };
      const masterRow = toRow(masterObj, COLS_MASTER);

      // B. Preparar Detalle (Items y Costos)
      const COLS_ITEM = ['id','quoteId','num','qty','desc','price','total'];
      const rowsItems = items.map(i => toRow({
        ...i, num: i.itemNumber, qty: i.quantity, desc: i.description, price: i.unitPrice, total: i.quantity * i.unitPrice
      }, COLS_ITEM));

      const COLS_COST = ['id','quoteId','num','code','prov','qty','cost','disc','total'];
      const rowsCosts = costs.map(c => toRow({
        ...c, num: c.itemNumber, prov: c.provider, qty: c.quantity, cost: c.unitCost, disc: c.discountPercent,
        total: (c.quantity * c.unitCost) * (1 - c.discountPercent/100)
      }, COLS_COST));

      // C. LÓGICA UPSERT (Buscar si existe para actualizar)
      const search = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: DB.QUOTES.id, range: `${DB.QUOTES.sheet}!A:A`
      });
      const ids = search.result.values?.flat() || [];
      const idx = ids.findIndex((id: string) => id === quoteId);

      if (idx !== -1) {
        // UPDATE: Sobrescribir fila existente
        await window.gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: DB.QUOTES.id, range: `${DB.QUOTES.sheet}!A${idx + 1}`,
          valueInputOption: 'USER_ENTERED', resource: { values: [masterRow] }
        });
      } else {
        // CREATE: Agregar nueva fila
        await window.gapi.client.sheets.spreadsheets.values.append({
          spreadsheetId: DB.QUOTES.id, range: `${DB.QUOTES.sheet}!A1`,
          valueInputOption: 'USER_ENTERED', resource: { values: [masterRow] }
        });
      }

      // D. GUARDAR DETALLES (Siempre Append para histórico, o podrías borrar y reescribir)
      const saveAux = async (db: any, vals: any[][]) => {
        if (vals.length) await window.gapi.client.sheets.spreadsheets.values.append({
          spreadsheetId: db.id, range: `${db.sheet}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: vals }
        });
      };
      
      await Promise.all([saveAux(DB.ITEMS, rowsItems), saveAux(DB.COSTS, rowsCosts)]);
      
      alert("✅ Guardado exitosamente en la base de datos distribuida.");
    } catch (e: any) {
      console.error(e);
      alert(`❌ Error al guardar: ${e.result?.error?.message || e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // --------------------------------------------------------------------------
  // 5. INTERFAZ DE USUARIO (RENDER)
  // --------------------------------------------------------------------------

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-sans">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Cotizador Pro</h1>
          <p className="text-slate-400 mb-8">Sistema de Gestión Ecomoving</p>
          <button onClick={handleLogin} disabled={!isReady} className="bg-indigo-600 hover:bg-indigo-500 text-white py-3 px-8 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center gap-3 mx-auto">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545 10.239v3.821h5.445c-0.712 2.315-2.647 3.972-5.445 3.972-3.332 0-6.033-2.701-6.033-6.032s2.701-6.032 6.033-6.032c1.498 0 2.866 0.549 3.921 1.453l2.814-2.814c-1.79-1.677-4.184-2.702-6.735-2.702-5.522 0-10 4.478-10 10s4.478 10 10 10c8.396 0 10.249-7.85 9.426-11.748l-9.426 0.082z"/></svg>
            {isReady ? 'Iniciar Sesión con Google' : 'Cargando sistema...'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 pb-20 font-sans">
      {/* HEADER */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40 shadow-lg">
        <div className="max-w-[1600px] mx-auto px-6 py-3">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-white">Cotizador Pro</h1>
              <span className="bg-slate-700 px-2 py-1 rounded text-xs font-mono text-indigo-300">{quoteId}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-white">{user.name}</div>
                <div className="text-[10px] text-slate-400">{user.email}</div>
              </div>
              <img src={user.avatar} alt="p" className="w-8 h-8 rounded-full border border-slate-600" />
              <button onClick={handleLogout} className="text-slate-500 hover:text-red-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
              
              <div className="h-6 w-px bg-slate-600 mx-2"></div>
              
              <button onClick={() => setIsModalOpen(true)} className={`px-3 py-1.5 rounded-full border text-sm ${getStatusColor(quoteStatus)}`}>{quoteStatus}</button>
              <button onClick={handleSave} disabled={isSaving} className={`flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-medium transition-colors ${isSaving ? 'opacity-70' : ''}`}>
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
              <button onClick={() => { if(confirm("¿Limpiar?")) { setItems([]); setCosts([]); setQuoteId(`COT-${Math.floor(Math.random()*9000)+1000}`); }}} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded text-sm text-white">Nuevo</button>
            </div>
          </div>

          {/* RESUMEN FINANCIERO */}
          <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-3 flex justify-between items-center text-sm">
             <div><span className="text-slate-500 text-xs font-bold">NETO</span> <span className="text-white font-mono text-lg ml-2">{formatMoney(financials.revenue)}</span></div>
             <div><span className="text-slate-500 text-xs font-bold">IVA (19%)</span> <span className="text-slate-300 font-mono text-lg ml-2">{formatMoney(financials.tax)}</span></div>
             <div className="h-8 w-px bg-slate-700"></div>
             <div><span className="text-emerald-400 text-xs font-bold">TOTAL</span> <span className="text-emerald-400 font-mono text-xl font-bold ml-2">{formatMoney(financials.total)}</span></div>
             <div className="flex-1"></div>
             <div className="text-right"><span className="text-slate-500 text-xs block">MARGEN</span> <span className={`${financials.margin >= 0 ? 'text-indigo-400' : 'text-red-400'} font-mono`}>{formatMoney(financials.margin)} ({(financials.marginPct * 100).toFixed(1)}%)</span></div>
          </div>
        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <main className="max-w-[1600px] mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* CARD CLIENTE */}
           <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <h3 className="font-semibold text-slate-200 mb-4 flex justify-between">
                Información Cliente 
                {isLoadingData && <span className="text-xs text-amber-400 animate-pulse">Cargando DB...</span>}
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 items-center">
                   <label className="text-xs text-slate-500 uppercase font-medium">Cuenta</label>
                   <select 
                     className="col-span-2 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-indigo-500"
                     onChange={(e) => {
                       const c = clientsList.find(x => x.id === e.target.value);
                       if(c) setClientInfo({...clientInfo, clientId: c.id, clientName: c.name});
                     }}
                   >
                     <option value="">Seleccionar...</option>
                     {clientsList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                   </select>
                </div>
                <div className="grid grid-cols-3 gap-4 items-center">
                   <label className="text-xs text-slate-500 uppercase font-medium">Contacto</label>
                   <select 
                     className="col-span-2 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm outline-none"
                     onChange={(e) => {
                        const ct = contactsList.find(x => x.id === e.target.value);
                        if(ct) setClientInfo({...clientInfo, contactId: ct.id, contactName: ct.name});
                     }}
                   >
                     <option value="">Seleccionar...</option>
                     {contactsList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                   </select>
                </div>
                <div className="grid grid-cols-3 gap-4 items-center">
                   <label className="text-xs text-slate-500 uppercase font-medium">ID Mercado P.</label>
                   <EditableInput value={clientInfo.marketId} onChange={(v:any)=>setClientInfo({...clientInfo, marketId: v})} className="col-span-2" />
                </div>
              </div>
           </div>
           
           {/* CARD EJECUTIVO */}
           <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <h3 className="font-semibold text-slate-200 mb-4">Ejecutivo Comercial</h3>
              <div className="space-y-3 opacity-80">
                <div className="grid grid-cols-3 gap-4"><label className="text-xs text-slate-500 uppercase">Nombre</label><div className="col-span-2 text-sm">{execInfo.name}</div></div>
                <div className="grid grid-cols-3 gap-4"><label className="text-xs text-slate-500 uppercase">Email</label><div className="col-span-2 text-sm">{execInfo.email}</div></div>
              </div>
           </div>
        </div>

        {/* TABLA ITEMS */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
           <div className="p-4 bg-slate-800/50 border-b border-slate-700"><h3 className="font-semibold text-slate-200">Items Cotización</h3></div>
           <div className="overflow-x-auto">
             <table className="w-full text-left text-sm text-slate-300">
               <thead className="text-xs uppercase bg-slate-900/30 text-slate-500">
                 <tr>
                   <th className="p-3 text-center w-12">#</th>
                   <th className="p-3 w-16 text-center">Cant</th>
                   <th className="p-3">Descripción</th>
                   <th className="p-3 text-right w-32">Unitario</th>
                   <th className="p-3 text-right w-32">Total</th>
                   <th className="p-3 w-8"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-700/50">
                 {items.map(item => (
                   <tr key={item.id} className="hover:bg-slate-700/30">
                     <td className="p-3 text-center">{item.itemNumber}</td>
                     <td className="p-3"><EditableInput type="number" align="center" value={item.quantity} onChange={(v:any) => setItems(items.map(x => x.id===item.id ? {...x, quantity: +v} : x))} /></td>
                     <td className="p-3"><textarea rows={1} className="w-full bg-transparent resize-none outline-none" value={item.description} onChange={e => setItems(items.map(x => x.id===item.id ? {...x, description: e.target.value} : x))} /></td>
                     <td className="p-3"><EditableInput type="number" align="right" value={item.unitPrice} onChange={(v:any) => setItems(items.map(x => x.id===item.id ? {...x, unitPrice: +v} : x))} /></td>
                     <td className="p-3 text-right font-mono">{formatMoney(item.quantity * item.unitPrice)}</td>
                     <td className="p-3 text-center"><button onClick={()=>setItems(items.filter(x=>x.id!==item.id))} className="text-slate-600 hover:text-red-400">×</button></td>
                   </tr>
                 ))}
                 <tr className="bg-slate-900/20 border-t-2 border-dashed border-slate-700">
                    <td className="p-3 text-center">+</td>
                    <td className="p-3"><input type="number" value={newItem.quantity} onChange={e=>setNewItem({...newItem, quantity:+e.target.value})} className="w-full bg-slate-800 border-slate-600 rounded px-1 text-center" /></td>
                    <td className="p-3"><input type="text" value={newItem.description} onChange={e=>setNewItem({...newItem, description:e.target.value})} className="w-full bg-slate-800 border-slate-600 rounded px-2" placeholder="Nuevo item..." /></td>
                    <td className="p-3"><input type="number" value={newItem.unitPrice} onChange={e=>setNewItem({...newItem, unitPrice:+e.target.value})} className="w-full bg-slate-800 border-slate-600 rounded px-2 text-right" placeholder="$" /></td>
                    <td colSpan={2} className="p-3 text-right"><button onClick={() => {
                        setItems([...items, { id: crypto.randomUUID(), quoteId, itemNumber: items.length+1, image:'', quantity: newItem.quantity||1, description: newItem.description||'', unitPrice: newItem.unitPrice||0 }]);
                        setNewItem({quantity:1, unitPrice:0, description:''});
                    }} className="bg-indigo-600 px-3 py-1 rounded text-white text-xs">Agregar</button></td>
                 </tr>
               </tbody>
             </table>
           </div>
        </div>

        {/* TABLA COSTOS */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
           <div className="p-4 bg-slate-800/50 border-b border-slate-700"><h3 className="font-semibold text-slate-200">Costos Asociados</h3></div>
           <div className="overflow-x-auto">
             <table className="w-full text-left text-sm text-slate-300">
               <thead className="text-xs uppercase bg-slate-900/30 text-slate-500">
                 <tr>
                   <th className="p-3 text-center w-12">Item</th>
                   <th className="p-3">Proveedor</th>
                   <th className="p-3 w-16 text-center">Cant</th>
                   <th className="p-3 text-right w-24">Costo</th>
                   <th className="p-3 text-right w-24">Desc %</th>
                   <th className="p-3 text-right w-24">Total</th>
                   <th className="p-3 w-8"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-700/50">
                 {costs.map(c => (
                   <tr key={c.id} className="hover:bg-slate-700/30">
                     <td className="p-3 text-center"><EditableInput align="center" value={c.itemNumber} onChange={(v:any)=>setCosts(costs.map(x=>x.id===c.id ? {...x, itemNumber:+v} : x))} /></td>
                     <td className="p-3"><EditableInput value={c.provider} onChange={(v:any)=>setCosts(costs.map(x=>x.id===c.id ? {...x, provider:v} : x))} /></td>
                     <td className="p-3"><EditableInput type="number" align="center" value={c.quantity} onChange={(v:any)=>setCosts(costs.map(x=>x.id===c.id ? {...x, quantity:+v} : x))} /></td>
                     <td className="p-3"><EditableInput type="number" align="right" value={c.unitCost} onChange={(v:any)=>setCosts(costs.map(x=>x.id===c.id ? {...x, unitCost:+v} : x))} /></td>
                     <td className="p-3"><EditableInput type="number" align="right" value={c.discountPercent} onChange={(v:any)=>setCosts(costs.map(x=>x.id===c.id ? {...x, discountPercent:+v} : x))} /></td>
                     <td className="p-3 text-right font-mono text-slate-400">{formatMoney(c.quantity * c.unitCost * (1-c.discountPercent/100))}</td>
                     <td className="p-3 text-center"><button onClick={()=>setCosts(costs.filter(x=>x.id!==c.id))} className="text-slate-600 hover:text-red-400">×</button></td>
                   </tr>
                 ))}
                 <tr className="bg-slate-900/20 border-t-2 border-dashed border-slate-700">
                    <td className="p-3"><input type="number" value={newCost.itemNumber} onChange={e=>setNewCost({...newCost, itemNumber:+e.target.value})} className="w-full bg-slate-800 border-slate-600 rounded px-1 text-center" /></td>
                    <td className="p-3"><input type="text" value={newCost.provider} onChange={e=>setNewCost({...newCost, provider:e.target.value})} className="w-full bg-slate-800 border-slate-600 rounded px-2" placeholder="Proveedor..." /></td>
                    <td className="p-3"><input type="number" value={newCost.quantity} onChange={e=>setNewCost({...newCost, quantity:+e.target.value})} className="w-full bg-slate-800 border-slate-600 rounded px-1 text-center" /></td>
                    <td className="p-3"><input type="number" value={newCost.unitCost} onChange={e=>setNewCost({...newCost, unitCost:+e.target.value})} className="w-full bg-slate-800 border-slate-600 rounded px-2 text-right" placeholder="$" /></td>
                    <td className="p-3"><input type="number" value={newCost.discountPercent} onChange={e=>setNewCost({...newCost, discountPercent:+e.target.value})} className="w-full bg-slate-800 border-slate-600 rounded px-2 text-right" placeholder="%" /></td>
                    <td colSpan={2} className="p-3 text-right"><button onClick={() => {
                         setCosts([...costs, { id: crypto.randomUUID(), quoteId, itemNumber: newCost.itemNumber||1, code:'', provider: newCost.provider||'', quantity: newCost.quantity||1, unitCost: newCost.unitCost||0, discountPercent: newCost.discountPercent||0 }]);
                         setNewCost({quantity:1, unitCost:0, discountPercent:0, provider:'', itemNumber:1});
                    }} className="bg-emerald-600 px-3 py-1 rounded text-white text-xs">+</button></td>
                 </tr>
               </tbody>
             </table>
           </div>
        </div>
      </main>

      {/* MODAL ESTADO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md p-6 shadow-2xl">
             <h3 className="text-xl font-bold text-white mb-4">Estado del Documento</h3>
             <div className="grid grid-cols-2 gap-3 mb-6">
                {['Pendiente','Producción','Despachada','Facturada','Perdida'].map((s: any) => (
                  <button key={s} onClick={()=>setTempStatus(s)} className={`px-4 py-2 rounded border text-sm font-medium transition-all ${tempStatus === s ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-600 text-slate-400'}`}>{s}</button>
                ))}
             </div>
             <div className="space-y-3 pt-4 border-t border-slate-700">
                <div><label className="text-xs text-slate-500 block mb-1">Orden de Compra</label><input value={tempDocs.oc} onChange={e=>setTempDocs({...tempDocs, oc:e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" /></div>
                <div><label className="text-xs text-slate-500 block mb-1">Guía de Despacho</label><input value={tempDocs.guia} onChange={e=>setTempDocs({...tempDocs, guia:e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" /></div>
                <div><label className="text-xs text-slate-500 block mb-1">Factura</label><input value={tempDocs.factura} onChange={e=>setTempDocs({...tempDocs, factura:e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" /></div>
             </div>
             <div className="mt-6 flex justify-end gap-3">
               <button onClick={()=>setIsModalOpen(false)} className="px-4 py-2 rounded text-slate-400 hover:text-white">Cancelar</button>
               <button onClick={()=>{ setQuoteStatus(tempStatus); setDocs(tempDocs); setIsModalOpen(false); }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded font-bold">Confirmar</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
