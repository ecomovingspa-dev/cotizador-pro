import React, { useState, useMemo, useEffect, useRef } from 'react';

// =================================================================
// 🚨 CONFIGURACIÓN DE CONEXIÓN GOOGLE (ARQUITECTURA MULTI-ARCHIVO)
// =================================================================

const API_KEY: string = 'AIzaSyCShAoumSMfgaSHfx07Gc9eOJWNUev8IsE'; 
const CLIENT_ID: string = '367886195210-kcoq4srkcsei95mbs9rimg4dg1le93l7.apps.googleusercontent.com'; 
const SCOPES: string = 'https://www.googleapis.com/auth/spreadsheets email profile openid';
const DISCOVERY_DOCS: string[] = ['https://sheets.googleapis.com/$discovery/rest?version=v4'];

// 🗂️ MAPA DE ARCHIVOS (BASE DE DATOS DISTRIBUIDA)
// IDs extraídos de tus imágenes
const DB_CONFIG = {
    QUOTES: {
        fileId: '1pU9mnO7NXHFp9PUVP4O548SO79KkJrFbNvRHSppv9-8', 
        sheetName: 'Maestro_Cotizaciones'
    },
    ITEMS: {
        fileId: '1scu3ndKCAUqKKlZBEWiYUyWYghtQIBgmTknw5A4zqTo', 
        sheetName: 'Maestro_Items'
    },
    COSTS: {
        fileId: '1DjUKP0vNgqPWs0FN94GW1GndnU1a9NaolKsZxLsBZ4Y', 
        sheetName: 'Maestro_Costos'
    },
    CLIENTS: {
        fileId: '1jpAhYMnc7xdZ22Wh6SoC9ygTb1lIRA6AAchvmk691Z0', 
        sheetName: 'Maestro_Cuentas'
    },
    CONTACTS: {
        fileId: '1V0FRA2gro7yPwPXDPEA8oq1H9oivlNQ0FrLJnL8qAIA', 
        sheetName: 'Maestro_Contactos'
    }
};

declare global {
    interface Window {
        gapi: any;
        google: any;
    }
}

// --- Tipos de Datos ---

interface User { id: string; name: string; email: string; avatar: string; role?: string; }
interface Client { id: string; cliente: string; sector: string; segmento: string; web: string; estado: string; correo: string; telefono: string; ciudad: string; }
interface Contact { id: string; clientId: string; cliente: string; name: string; email: string; telefono: string; celular: string; estado: string; etapaEnvio: string; ultimoEnvio: string; proximoEnvio: string; segmento: string; errorLog: string; ciudad: string; departamento: string; }
interface QuoteItem { id: string; quoteId: string; itemNumber: number; image: string; quantity: number; description: string; unitPrice: number; }
interface QuoteCost { id: string; quoteId: string; itemNumber: number; code: string; provider: string; quantity: number; unitCost: number; discountPercent: number; }
interface QuoteDocuments { oc: string; guia: string; factura: string; }
type QuoteStatus = 'Pendiente' | 'Producción' | 'Despachada' | 'Facturada' | 'Perdida';

// --- Mock Data (Para funcionamiento local de UI) ---

const MOCK_CLIENTS: Client[] = [
  { id: 'c1', cliente: 'Ecomoving Ltda.', sector: 'Retail', segmento: 'Grande', web: 'www.ecomoving.cl', estado: 'Activo', correo: 'contacto@ecomoving.cl', telefono: '+56 2 2233 4455', ciudad: 'Santiago' },
  { id: 'c2', cliente: 'Minera Escondida', sector: 'Minería', segmento: 'Corporativo', web: 'www.minera.cl', estado: 'Activo', correo: 'adquisiciones@minera.cl', telefono: '+56 55 2222 3333', ciudad: 'Antofagasta' },
  { id: 'c3', cliente: 'Banco Estado', sector: 'Banca', segmento: 'Público', web: 'www.bancoestado.cl', estado: 'Activo', correo: 'compras@bancoestado.cl', telefono: '+56 2 600 200 7000', ciudad: 'Santiago' },
  { id: 'c4', cliente: 'Falabella Retail', sector: 'Retail', segmento: 'Grande', web: 'www.falabella.cl', estado: 'Inactivo', correo: 'proveedores@falabella.cl', telefono: '+56 2 2333 3333', ciudad: 'Santiago' },
  { id: 'c5', cliente: 'Cliente Nuevo SPA', sector: 'Tecnología', segmento: 'Pyme', web: 'www.nuevospa.cl', estado: 'Prospecto', correo: 'hola@nuevospa.cl', telefono: '+56 9 9999 9999', ciudad: 'Concepción' },
];

const MOCK_CONTACTS: Contact[] = [
  { id: 'ct1', clientId: 'c1', cliente: 'Ecomoving Ltda.', name: 'Juan Pérez', email: 'jperez@ecomoving.cl', telefono: '+56 2 2222 1111', celular: '+56 9 1111 1111', estado: 'Suscrito', etapaEnvio: '1', ultimoEnvio: '2023-10-01', proximoEnvio: '2023-11-01', segmento: 'Gerencia', errorLog: '', ciudad: 'Santiago', departamento: 'Comercial' },
  { id: 'ct2', clientId: 'c2', cliente: 'Minera Escondida', name: 'Maria Gonzalez', email: 'mgonzalez@minera.cl', telefono: '+56 55 2222 2222', celular: '+56 9 2222 2222', estado: 'Suscrito', etapaEnvio: '2', ultimoEnvio: '2023-10-05', proximoEnvio: '2023-11-05', segmento: 'Adquisiciones', errorLog: '', ciudad: 'Antofagasta', departamento: 'Compras' },
  { id: 'ct3', clientId: 'c2', cliente: 'Minera Escondida', name: 'Roberto Diaz', email: 'rdiaz@minera.cl', telefono: '+56 55 3333 3333', celular: '+56 9 3333 3333', estado: 'Rebotado', etapaEnvio: '0', ultimoEnvio: '2023-09-01', proximoEnvio: '', segmento: 'Operaciones', errorLog: 'Mailbox full', ciudad: 'Antofagasta', departamento: 'Logística' },
  { id: 'ct4', clientId: 'c3', cliente: 'Banco Estado', name: 'Patricia Leiva', email: 'pleiva@bancoestado.cl', telefono: '+56 2 4444 4444', celular: '+56 9 4444 4444', estado: 'Suscrito', etapaEnvio: '1', ultimoEnvio: '2023-10-10', proximoEnvio: '2023-11-10', segmento: 'Finanzas', errorLog: '', ciudad: 'Santiago', departamento: 'Contabilidad' },
  { id: 'ct5', clientId: 'c4', cliente: 'Falabella Retail', name: 'Esteban Quito', email: 'equito@falabella.cl', telefono: '+56 2 5555 5555', celular: '+56 9 5555 5555', estado: 'Desuscrito', etapaEnvio: '3', ultimoEnvio: '2023-08-15', proximoEnvio: '', segmento: 'Marketing', errorLog: '', ciudad: 'Santiago', departamento: 'Marketing' },
];

// Componentes UI
const EditableInput = ({ value, onChange, type = "text", className = "", placeholder = "", align = "left", readOnly = false }: any) => (
  <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} readOnly={readOnly}
    className={`w-full bg-transparent border-b border-transparent outline-none px-2 py-1 text-slate-200 placeholder-slate-600 text-${align} ${className} ${readOnly ? 'cursor-default text-slate-400' : 'hover:border-slate-600 focus:border-indigo-500 focus:bg-slate-800/50 transition-all'}`} />
);
const getStatusColor = (status: QuoteStatus) => {
  switch(status) {
    case 'Producción': return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
    case 'Despachada': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    case 'Facturada': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
    case 'Perdida': return 'bg-red-500/20 text-red-400 border-red-500/50';
    default: return 'bg-slate-700 text-slate-300 border-slate-600';
  }
};
const objectToArray = (obj: any, keysOrder: string[]) => keysOrder.map(key => obj[key] || '');

export default function App() {
    // --- State ---
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [tokenClient, setTokenClient] = useState<any>(null);
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [activeQuoteId, setActiveQuoteId] = useState('COT-4738');
    const [items, setItems] = useState<QuoteItem[]>([]);
    const [costs, setCosts] = useState<QuoteCost[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [taxRate, setTaxRate] = useState<number>(19);
    const [isSaving, setIsSaving] = useState(false);
    const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>('Pendiente');
    const [quoteDocs, setQuoteDocs] = useState<QuoteDocuments>({ oc: '', guia: '', factura: '' });
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [tempStatus, setTempStatus] = useState<QuoteStatus>('Pendiente');
    const [tempDocs, setTempDocs] = useState<QuoteDocuments>({ oc: '', guia: '', factura: '' });
    const [clientInfo, setClientInfo] = useState({ clientId: '', clientName: '', contactId: '', contactName: '', marketId: '', city: '', sector: '', phone: '' });
    const [executiveInfo, setExecutiveInfo] = useState({ name: '', email: '', phone: '' });
    const [newItem, setNewItem] = useState<Partial<QuoteItem>>({ quantity: 1, unitPrice: 0, description: '' });
    const [newCost, setNewCost] = useState<Partial<QuoteCost>>({ quantity: 1, unitCost: 0, discountPercent: 0, provider: '', code: '', itemNumber: 1 });

    // --- INICIALIZACIÓN GOOGLE (GIS + GAPI) ---
    useEffect(() => {
        const initializeGoogle = () => {
            if (window.google) {
                const client = window.google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: async (response: any) => {
                        if (response.access_token) {
                            setIsSignedIn(true);
                            if (window.gapi.client) window.gapi.client.setToken(response);
                            
                            const userInfoReq = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                                headers: { Authorization: `Bearer ${response.access_token}` }
                            });
                            const userInfo = await userInfoReq.json();
                            setCurrentUser({
                                id: userInfo.sub,
                                name: userInfo.name,
                                email: userInfo.email,
                                avatar: userInfo.picture,
                                role: 'Usuario Google'
                            });
                            setExecutiveInfo({ name: userInfo.name, email: userInfo.email, phone: '' });
                        }
                    },
                });
                setTokenClient(client);
            }

            if (window.gapi) {
                window.gapi.load('client', async () => {
                    await window.gapi.client.init({
                        apiKey: API_KEY,
                        discoveryDocs: DISCOVERY_DOCS,
                    });
                });
            }
        };
        const timer = setTimeout(initializeGoogle, 1000);
        return () => clearTimeout(timer);
    }, []);

    const handleLogin = () => {
        if (tokenClient) tokenClient.requestAccessToken();
        else alert("Cargando Google... intente en unos segundos");
    };

    const handleLogout = () => {
        const token = window.gapi.client.getToken();
        if (token) {
            window.google.accounts.oauth2.revoke(token.access_token, () => {
                window.gapi.client.setToken(null);
                setCurrentUser(null);
                setIsSignedIn(false);
            });
        }
    };

    // --- Lógica de Negocio ---
    const getCostsForItem = (itemNumber: number) => costs.filter(c => c.itemNumber === itemNumber);
    const calculateItemFinancials = (item: QuoteItem) => {
      const revenue = item.quantity * item.unitPrice;
      const relatedCosts = getCostsForItem(item.itemNumber);
      const totalCost = relatedCosts.reduce((acc, cost) => acc + (cost.quantity * cost.unitCost) * (1 - (cost.discountPercent / 100)), 0);
      const margin = revenue - totalCost;
      const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;
      return { revenue, totalCost, margin, marginPercent };
    };

    const globalTotals = useMemo(() => {
      let totalRev = 0; let totalCost = 0;
      items.forEach(item => {
        const fins = calculateItemFinancials(item);
        totalRev += fins.revenue;
        totalCost += fins.totalCost;
      });
      const net = totalRev;
      const taxAmount = Math.round(net * (taxRate / 100));
      return {
        revenue: totalRev, cost: totalCost, margin: totalRev - totalCost,
        marginPercent: totalRev > 0 ? ((totalRev - totalCost) / totalRev) * 100 : 0,
        taxAmount, totalWithTax: net + taxAmount
      };
    }, [items, costs, taxRate]);

    // --- GUARDADO MULTI-ARCHIVO (LÓGICA ACTUALIZADA) ---
    const handleSaveToDrive = async () => {
        if (!currentUser) return alert("Debes iniciar sesión.");
        setIsSaving(true);
        const timestamp = new Date().toISOString();

        try {
            // 1. PREPARAR DATOS
            
            // Archivo: Cotizaciones (Maestro_Cotizaciones)
            const MASTER_KEYS = ['id', 'createdAt', 'clientId', 'clientName', 'contactName', 'marketId', 'executiveName', 'executiveEmail', 'status', 'oc', 'guia', 'factura', 'neto', 'iva', 'total', 'costo_total', 'margen_porcentaje'];
            const masterData = {
                id: activeQuoteId, createdAt: timestamp, clientId: clientInfo.clientId, clientName: clientInfo.clientName,
                contactName: clientInfo.contactName, marketId: clientInfo.marketId, executiveName: executiveInfo.name,
                executiveEmail: executiveInfo.email, status: quoteStatus, oc: quoteDocs.oc, guia: quoteDocs.guia,
                factura: quoteDocs.factura, neto: globalTotals.revenue, iva: globalTotals.taxAmount, total: globalTotals.totalWithTax,
                costo_total: globalTotals.cost, margen_porcentaje: globalTotals.marginPercent.toFixed(2)
            };
            const masterRow = objectToArray(masterData, MASTER_KEYS);

            // Archivo: Items (Maestro_Items)
            const ITEMS_KEYS = ['id', 'quoteId', 'itemNumber', 'quantity', 'description', 'unitPrice', 'total'];
            const itemRows = items.map(i => objectToArray({ ...i, quoteId: activeQuoteId, total: i.quantity * i.unitPrice }, ITEMS_KEYS));

            // Archivo: Costos (Maestro_Costos)
            const COSTS_KEYS = ['id', 'quoteId', 'itemNumber', 'code', 'provider', 'quantity', 'unitCost', 'discountPercent', 'total'];
            const costRows = costs.map(c => objectToArray({ ...c, quoteId: activeQuoteId, total: (c.quantity * c.unitCost) * (1 - c.discountPercent/100) }, COSTS_KEYS));

            // 2. FUNCIÓN DE APENDIZADO (Soporta ID de archivo dinámico)
            const appendToSheet = async (fileId: string, sheetName: string, values: any[][]) => {
                if (values.length === 0) return;
                if (!fileId || fileId.includes('REEMPLAZAR')) {
                    console.error(`Falta ID válido para ${sheetName}`);
                    return; 
                }
                await window.gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId: fileId, 
                    range: `${sheetName}!A1`, // Escribe al final de la hoja especificada
                    valueInputOption: 'USER_ENTERED', 
                    resource: { values }
                });
            };

            // 3. EJECUTAR ESCRITURA EN PARALELO A DIFERENTES ARCHIVOS
            await Promise.all([
                appendToSheet(DB_CONFIG.QUOTES.fileId, DB_CONFIG.QUOTES.sheetName, [masterRow]),
                appendToSheet(DB_CONFIG.ITEMS.fileId, DB_CONFIG.ITEMS.sheetName, itemRows),
                appendToSheet(DB_CONFIG.COSTS.fileId, DB_CONFIG.COSTS.sheetName, costRows)
            ]);

            setIsSaving(false);
            alert(`¡Cotización ${activeQuoteId} guardada en el sistema (múltiples archivos) exitosamente!`);
        } catch (error: any) {
            setIsSaving(false);
            console.error("Error guardando:", error);
            alert("Error al guardar. Revisa la consola para ver qué archivo falló.");
        }
    };

    // --- Handlers UI ---
    const handleClientChange = (id: string) => {
        const c = MOCK_CLIENTS.find(cli => cli.id === id);
        if (c) setClientInfo({ clientId: c.id, clientName: c.cliente, marketId: '', contactId: '', contactName: '', city: c.ciudad, sector: c.sector, phone: c.telefono });
        else setClientInfo({ clientId: '', clientName: '', marketId: '', contactId: '', contactName: '', city: '', sector: '', phone: '' });
    };
    const handleContactChange = (id: string) => {
        const c = MOCK_CONTACTS.find(ct => ct.id === id);
        if (c) setClientInfo(prev => ({ ...prev, contactId: c.id, contactName: c.name }));
    };
    const handleNewQuote = () => {
        if(window.confirm("¿Nueva cotización?")) {
            setActiveQuoteId(`COT-${Math.floor(1000 + Math.random() * 9000)}`);
            setItems([]); setCosts([]); setQuoteStatus('Pendiente');
            setQuoteDocs({ oc: '', guia: '', factura: '' });
            setClientInfo({ clientId: '', clientName: '', contactId: '', contactName: '', marketId: '', city: '', sector: '', phone: '' });
        }
    };
    const handleAddItem = () => {
        const next = items.length > 0 ? Math.max(...items.map(i => i.itemNumber)) + 1 : 1;
        setItems([...items, { id: crypto.randomUUID(), quoteId: activeQuoteId, itemNumber: next, image: 'https://placehold.co/100x100/png?text=Img', quantity: newItem.quantity || 1, description: newItem.description || 'Item', unitPrice: Number(newItem.unitPrice) || 0 }]);
        setNewItem({ quantity: 1, unitPrice: 0, description: '' });
    };
    const handleAddCost = () => {
        setCosts([...costs, { id: crypto.randomUUID(), quoteId: activeQuoteId, itemNumber: Number(newCost.itemNumber) || 1, code: newCost.code || '', provider: newCost.provider || '', quantity: newCost.quantity || 1, unitCost: Number(newCost.unitCost) || 0, discountPercent: Number(newCost.discountPercent) || 0 }]);
        setNewCost({ quantity: 1, unitCost: 0, discountPercent: 0, provider: '', code: '', itemNumber: 1 });
    };
    const deleteItem = (id: string) => setItems(items.filter(i => i.id !== id));
    const deleteCost = (id: string) => setCosts(costs.filter(c => c.id !== id));
    const formatCurrency = (val: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);
    const formatPercent = (val: number) => `${val.toFixed(2)}%`;

    // RENDER LOGIN
    if (!isSignedIn) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
                <div className="w-full max-w-md text-center">
                    <h1 className="text-3xl font-bold text-white mb-2">Cotizador Pro</h1>
                    <p className="text-slate-400 mb-8">Gestión de Cotizaciones Ecomoving</p>
                    <button onClick={handleLogin} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-3">
                        <svg className="w-6 h-6" viewBox="0 0 24 24"><path d="M22.54 12.064c0-.7-.06-1.3-.17-1.9H12v3.5h6.3C18.15 15.1 17.52 16.5 16.54 17.5l2.76 2.14c1.6-1.46 2.58-3.56 2.58-5.58z" fill="#4285F4"/><path d="M12 23c3.27 0 6.02-1.08 8.03-2.92l-2.76-2.14c-1.12.75-2.58 1.2-4.27 1.2-3.3 0-6.1-2.22-7.1-5.18H1.72v2.22C3.84 21.03 7.6 23 12 23z" fill="#34A853"/><path d="M4.9 14.93c-.22-.66-.36-1.35-.36-2.07s.14-1.41.36-2.07V8.64H1.72C1.3 9.4 1.08 10.37 1.08 11.86c0 1.48.22 2.45.64 3.22L4.9 14.93z" fill="#FBBC05"/><path d="M12 4.09c1.88 0 3.32.78 4.3 1.76l2.45-2.45C16.8 1.45 14.05.09 12 .09 7.6 0 3.84 1.97 1.72 5.06l3.18 2.44C5.9 5.86 8.7 3.65 12 3.65z" fill="#EA4335"/></svg>
                        Iniciar Sesión con Google
                    </button>
                </div>
            </div>
        );
    }

    // RENDER APP
    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 pb-20 font-sans selection:bg-indigo-500/30">
            <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40 shadow-lg">
                <div className="max-w-[1600px] mx-auto px-6 py-3">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-4 flex-1">
                            <h1 className="text-xl font-bold text-white">Cotizador Pro</h1>
                            <span className="bg-slate-700 px-2 py-1 rounded text-xs text-indigo-300 font-mono">ID: {activeQuoteId}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <div className="text-xs font-bold text-white">{currentUser?.name}</div>
                                <div className="text-[10px] text-slate-400">{currentUser?.email}</div>
                            </div>
                            <img src={currentUser?.avatar} alt="User" className="w-8 h-8 rounded-full border border-slate-600" />
                            <button onClick={handleLogout} className="text-slate-500 hover:text-red-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
                            <button onClick={() => setIsStatusModalOpen(true)} className={`px-3 py-1.5 rounded-full border text-sm ${getStatusColor(quoteStatus)}`}>{quoteStatus}</button>
                            <button onClick={handleSaveToDrive} disabled={isSaving} className={`flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md text-sm font-medium ${isSaving ? 'opacity-70' : ''}`}>
                                {isSaving ? 'Guardando...' : 'Guardar en Drive'}
                            </button>
                            <button onClick={handleNewQuote} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm">Nueva</button>
                        </div>
                    </div>
                    {/* Resumen Financiero */}
                    <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-3 flex flex-wrap items-center justify-between gap-6 text-sm">
                        <div className="flex flex-col"><span className="text-slate-400 text-xs font-bold">NETO</span><span className="text-white font-mono text-lg">{formatCurrency(globalTotals.revenue)}</span></div>
                        <div className="flex flex-col"><span className="text-slate-400 text-xs font-bold">IVA (19%)</span><span className="text-slate-200 font-mono text-lg">{formatCurrency(globalTotals.taxAmount)}</span></div>
                        <div className="h-8 w-px bg-slate-700 hidden md:block"></div>
                        <div className="flex flex-col"><span className="text-emerald-400 text-xs font-bold">TOTAL</span><span className="text-emerald-400 font-mono text-xl font-bold">{formatCurrency(globalTotals.totalWithTax)}</span></div>
                        <div className="flex-1"></div>
                        <div className="flex gap-6 text-right border-l border-slate-700 pl-6">
                            <div className="flex flex-col"><span className="text-slate-500 text-xs">COSTO</span><span className="text-slate-300 font-mono">{formatCurrency(globalTotals.cost)}</span></div>
                            <div className="flex flex-col"><span className="text-slate-500 text-xs">MARGEN</span><span className={`${globalTotals.margin >= 0 ? 'text-indigo-400' : 'text-red-400'} font-mono`}>{formatCurrency(globalTotals.margin)} ({formatPercent(globalTotals.marginPercent)})</span></div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-6 space-y-8">
                {/* Selectores Cliente/Contacto */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-sm">
                        <h2 className="font-semibold text-slate-200 mb-4">Información Cliente</h2>
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-4 items-center">
                                <label className="text-xs text-slate-500 font-medium uppercase">Cliente</label>
                                <select value={clientInfo.clientId} onChange={(e) => handleClientChange(e.target.value)} className="col-span-2 w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm outline-none">
                                    <option value="">Seleccionar...</option>
                                    {MOCK_CLIENTS.map(c => <option key={c.id} value={c.id}>{c.cliente}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-3 gap-4 items-center">
                                <label className="text-xs text-slate-500 font-medium uppercase">Contacto</label>
                                <select value={clientInfo.contactId} onChange={(e) => handleContactChange(e.target.value)} disabled={!clientInfo.clientId} className="col-span-2 w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm outline-none">
                                    {!clientInfo.clientId ? <option value="">Seleccione Cliente</option> : availableContacts.length === 0 ? <option value="">Sin contactos</option> : <option value="">Seleccionar...</option>}
                                    {availableContacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-3 gap-4 items-center">
                                <label className="text-xs text-slate-500 font-medium uppercase">ID Mercado P.</label>
                                <EditableInput value={clientInfo.marketId} onChange={(v: any) => setClientInfo(prev => ({...prev, marketId: v}))} className="col-span-2" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-sm">
                        <h2 className="font-semibold text-slate-200 mb-4">Ejecutivo</h2>
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-4 items-center"><label className="text-xs text-slate-500 uppercase">Nombre</label><EditableInput value={executiveInfo.name} readOnly className="col-span-2 text-slate-400" /></div>
                            <div className="grid grid-cols-3 gap-4 items-center"><label className="text-xs text-slate-500 uppercase">Email</label><EditableInput value={executiveInfo.email} readOnly className="col-span-2 text-slate-400" /></div>
                        </div>
                    </div>
                </div>

                {/* Tabla Items */}
                <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-700 bg-slate-800/50"><h3 className="font-semibold text-slate-200">Detalle Items</h3></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm text-slate-300">
                            <thead><tr className="text-xs uppercase text-slate-500 bg-slate-900/30 border-b border-slate-700"><th className="p-3 w-12 text-center">#</th><th className="p-3 w-20">Img</th><th className="p-3 w-16 text-center">Cant.</th><th className="p-3">Descripción</th><th className="p-3 w-32 text-right">Unitario</th><th className="p-3 w-32 text-right">Subtotal</th><th className="p-3 w-24 text-right">Margen</th><th className="p-3 w-10"></th></tr></thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {items.map(item => {
                                    const f = calculateItemFinancials(item);
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-700/30">
                                            <td className="p-3 text-center">{item.itemNumber}</td>
                                            <td className="p-3"><img src={item.image} className="w-8 h-8 rounded bg-slate-700 object-cover" alt="" /></td>
                                            <td className="p-3"><EditableInput type="number" align="center" value={item.quantity} onChange={(v: any) => setItems(items.map(i => i.id === item.id ? { ...i, quantity: Number(v) } : i))} /></td>
                                            <td className="p-3"><textarea value={item.description} onChange={e => setItems(items.map(i => i.id === item.id ? { ...i, description: e.target.value } : i))} className="w-full bg-transparent resize-none outline-none text-slate-300 bg-slate-800/30 rounded p-1" rows={2} /></td>
                                            <td className="p-3"><EditableInput type="number" align="right" value={item.unitPrice} onChange={(v: any) => setItems(items.map(i => i.id === item.id ? { ...i, unitPrice: Number(v) } : i))} /></td>
                                            <td className="p-3 text-right text-slate-200">{formatCurrency(f.revenue)}</td>
                                            <td className="p-3 text-right"><span className={`text-xs font-bold px-1.5 py-0.5 rounded ${f.marginPercent >= 20 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{f.marginPercent.toFixed(1)}%</span></td>
                                            <td className="p-3 text-center"><button onClick={() => setItems(items.filter(i => i.id !== item.id))} className="text-slate-600 hover:text-red-400">x</button></td>
                                        </tr>
                                    )
                                })}
                                <tr className="bg-slate-900/20 border-t-2 border-slate-700 border-dashed">
                                    <td className="p-3 text-center text-slate-600">+</td><td className="p-3"></td>
                                    <td className="p-3"><input type="number" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center text-xs" placeholder="1" /></td>
                                    <td className="p-3"><input type="text" value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs" placeholder="Descripción..." /></td>
                                    <td className="p-3"><input type="number" value={newItem.unitPrice} onChange={e => setNewItem({...newItem, unitPrice: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-right text-xs" placeholder="$0" /></td>
                                    <td colSpan={3} className="p-3 text-right"><button onClick={handleAddItem} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded">Agregar</button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Tabla Costos */}
                <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-700 bg-slate-800/50"><h3 className="font-semibold text-slate-200">Detalle Costos</h3></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm text-slate-300">
                            <thead><tr className="text-xs uppercase text-slate-500 bg-slate-900/30 border-b border-slate-700"><th className="p-3 w-20 text-center">Item #</th><th className="p-3 w-24">Cod</th><th className="p-3">Proveedor</th><th className="p-3 w-24 text-center">Cant.</th><th className="p-3 w-32 text-right">Costo</th><th className="p-3 w-24 text-right">Desc %</th><th className="p-3 w-32 text-right">Total</th><th className="p-3 w-10"></th></tr></thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {costs.map(cost => {
                                    const total = (cost.quantity * cost.unitCost) * (1 - cost.discountPercent/100);
                                    return (
                                        <tr key={cost.id} className="hover:bg-slate-700/30">
                                            <td className="p-3 text-center"><EditableInput align="center" value={cost.itemNumber} onChange={(v: any) => setCosts(costs.map(c => c.id === cost.id ? { ...c, itemNumber: Number(v) } : c))} /></td>
                                            <td className="p-3"><EditableInput value={cost.code} onChange={(v: any) => setCosts(costs.map(c => c.id === cost.id ? { ...c, code: v } : c))} /></td>
                                            <td className="p-3"><EditableInput value={cost.provider} onChange={(v: any) => setCosts(costs.map(c => c.id === cost.id ? { ...c, provider: v } : c))} /></td>
                                            <td className="p-3"><EditableInput type="number" align="center" value={cost.quantity} onChange={(v: any) => setCosts(costs.map(c => c.id === cost.id ? { ...c, quantity: Number(v) } : c))} /></td>
                                            <td className="p-3"><EditableInput type="number" align="right" value={cost.unitCost} onChange={(v: any) => setCosts(costs.map(c => c.id === cost.id ? { ...c, unitCost: Number(v) } : c))} /></td>
                                            <td className="p-3"><EditableInput type="number" align="right" value={cost.discountPercent} onChange={(v: any) => setCosts(costs.map(c => c.id === cost.id ? { ...c, discountPercent: Number(v) } : c))} /></td>
                                            <td className="p-3 text-right font-mono text-slate-400">{formatCurrency(total)}</td>
                                            <td className="p-3 text-center"><button onClick={() => setCosts(costs.filter(c => c.id !== cost.id))} className="text-slate-600 hover:text-red-400">x</button></td>
                                        </tr>
                                    )
                                })}
                                <tr className="bg-slate-900/20 border-t-2 border-slate-700 border-dashed">
                                    <td className="p-3"><input type="number" value={newCost.itemNumber} onChange={e => setNewCost({...newCost, itemNumber: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center text-xs" placeholder="1" /></td>
                                    <td className="p-3"><input type="text" value={newCost.code} onChange={e => setNewCost({...newCost, code: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs" placeholder="COD" /></td>
                                    <td className="p-3"><input type="text" value={newCost.provider} onChange={e => setNewCost({...newCost, provider: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs" placeholder="Prov" /></td>
                                    <td className="p-3"><input type="number" value={newCost.quantity} onChange={e => setNewCost({...newCost, quantity: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center text-xs" placeholder="1" /></td>
                                    <td className="p-3"><input type="number" value={newCost.unitCost} onChange={e => setNewCost({...newCost, unitCost: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-right text-xs" placeholder="$" /></td>
                                    <td className="p-3"><input type="number" value={newCost.discountPercent} onChange={e => setNewCost({...newCost, discountPercent: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-right text-xs" placeholder="%" /></td>
                                    <td className="p-3"></td>
                                    <td className="p-3 text-center"><button onClick={handleAddCost} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-2 py-1 rounded">+</button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>

            {/* Modal Estado */}
            {isStatusModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b border-slate-700 flex justify-between bg-slate-900/50"><h3 className="font-bold text-white">Estado</h3><button onClick={() => setIsStatusModalOpen(false)} className="text-slate-400">x</button></div>
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-2">
                                {(['Pendiente', 'Producción', 'Despachada', 'Facturada', 'Perdida'] as QuoteStatus[]).map(s => (
                                    <button key={s} onClick={() => setTempStatus(s)} className={`px-3 py-2 rounded text-sm border ${tempStatus === s ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>{s}</button>
                                ))}
                            </div>
                            <div className="space-y-3 pt-2 border-t border-slate-700/50">
                                <div><label className="text-xs text-slate-400 block mb-1">OC</label><input value={tempDocs.oc} onChange={e => setTempDocs({...tempDocs, oc: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white" /></div>
                                <div><label className="text-xs text-slate-400 block mb-1">Guía</label><input value={tempDocs.guia} onChange={e => setTempDocs({...tempDocs, guia: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white" /></div>
                                <div><label className="text-xs text-slate-400 block mb-1">Factura</label><input value={tempDocs.factura} onChange={e => setTempDocs({...tempDocs, factura: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white" /></div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex justify-end gap-3">
                            <button onClick={() => setIsStatusModalOpen(false)} className="px-4 py-2 rounded text-sm text-slate-400">Cancelar</button>
                            <button onClick={() => { setQuoteStatus(tempStatus); setQuoteDocs(tempDocs); setIsStatusModalOpen(false); }} className="px-4 py-2 rounded bg-indigo-600 text-white text-sm font-medium">Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
