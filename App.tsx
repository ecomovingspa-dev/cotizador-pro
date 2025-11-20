
import React, { useState, useMemo, useEffect, useRef } from 'react';

// --- Configuration ---

const DRIVE_DB_CONFIG = {
  folderName: 'BD_Ecomoving',
  // Master Quotes File (New)
  quotesFileId: '1pU9mnO7NXHFp9PUVP4O548SO79KkJrFbNvRHSppv9-8',
  quotesSheetName: 'Maestro_Cotizaciones',
  // Clients / Accounts
  accountsFileId: '1jpAhYMnc7xdZ22Wh6SoC9ygTb1lIRA6AAchvmk691Z0',
  accountsSheetName: 'Maestro_Cuentas',
  // Contacts
  contactsFileId: '1fFU5t7rmz4XV8FfArzSaoUIXKorZh03UGCqY-7AFkEM',
  contactsSheetName: 'Maestro_Contactos',
  // Users
  usersFolder: 'BD_Ecomoving',
  usersSheetName: 'Maestro_Usuarios' // Implied standard naming
};

// --- Types ---

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  avatar: string;
}

interface Client {
  id: string;
  name: string;
  marketId: string;
  rut: string;
  address: string;
}

interface Contact {
  id: string;
  clientId: string; // Foreign Key linking to Client.id
  name: string;
  email: string;
  phone: string;
}

interface QuoteItem {
  id: string;
  quoteId: string; // Foreign Key linking to Quote ID
  itemNumber: number;
  image: string;
  quantity: number;
  description: string;
  unitPrice: number;
}

interface QuoteCost {
  id: string;
  quoteId: string; // Foreign Key linking to Quote ID
  itemNumber: number; // Relates to QuoteItem.itemNumber
  code: string;
  provider: string;
  quantity: number;
  unitCost: number;
  discountPercent: number;
}

interface QuoteMaster {
  id: string;
  clientId: string;
  contactId: string;
  marketId: string;
  status: QuoteStatus;
  docs: QuoteDocuments;
  executiveId: string; // Who created it
  createdAt: string;
}

interface ClientInfoState {
  clientId: string;
  clientName: string;
  contactId: string;
  contactName: string;
  marketId: string;
}

interface ExecutiveInfo {
  name: string;
  email: string;
  phone: string;
}

interface QuoteDocuments {
  oc: string;
  guia: string;
  factura: string;
}

type QuoteStatus = 'Pendiente' | 'Enviada' | 'Aprobada' | 'Rechazada' | 'Facturada';

// --- Initial Data ---

const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Ana Silva',
    email: 'ana.silva@ecomoving.cl',
    phone: '+56 9 1234 5678',
    role: 'Ejecutiva Senior',
    avatar: 'https://i.pravatar.cc/150?u=ana'
  },
  {
    id: 'u2',
    name: 'Carlos Ruiz',
    email: 'carlos.ruiz@ecomoving.cl',
    phone: '+56 9 8765 4321',
    role: 'Ejecutivo de Ventas',
    avatar: 'https://i.pravatar.cc/150?u=carlos'
  },
  {
    id: 'u3',
    name: 'Administrador',
    email: 'admin@ecomoving.cl',
    phone: '+56 2 2222 2222',
    role: 'Gerencia',
    avatar: 'https://i.pravatar.cc/150?u=admin'
  }
];

// Simulating Google Sheets Data for Clients (Maestro_Cuentas)
const MOCK_CLIENTS: Client[] = [
  { id: 'c1', name: 'Ecomoving Ltda.', marketId: 'ID-998877', rut: '76.555.444-3', address: 'Av. Providencia 1234' },
  { id: 'c2', name: 'Minera Escondida', marketId: 'MIN-2024-X', rut: '90.111.222-K', address: 'Antofagasta Ind. 55' },
  { id: 'c3', name: 'Banco Estado', marketId: 'BE-LIC-001', rut: '60.888.000-1', address: 'Alameda 1111' },
  { id: 'c4', name: 'Falabella Retail', marketId: '', rut: '77.123.123-9', address: 'Rosas 1550' },
  { id: 'c5', name: 'Cliente Sin Contactos', marketId: '', rut: '55.555.555-5', address: 'Sin Direccion' },
];

// Simulating Google Sheets Data for Contacts (Maestro_Contactos)
const MOCK_CONTACTS: Contact[] = [
  { id: 'ct1', clientId: 'c1', name: 'Juan Pérez', email: 'jperez@ecomoving.cl', phone: '+56 9 1111 1111' },
  { id: 'ct2', clientId: 'c2', name: 'Maria Gonzalez', email: 'mgonzalez@minera.cl', phone: '+56 9 2222 2222' },
  { id: 'ct3', clientId: 'c2', name: 'Roberto Diaz', email: 'rdiaz@minera.cl', phone: '+56 9 3333 3333' },
  { id: 'ct4', clientId: 'c3', name: 'Patricia Leiva', email: 'pleiva@bancoestado.cl', phone: '+56 9 4444 4444' },
  { id: 'ct5', clientId: 'c4', name: 'Esteban Quito', email: 'equito@falabella.cl', phone: '+56 9 5555 5555' },
];

// --- INITIAL MOCK DATABASE (Simulating Sheets Relationships) ---

const INITIAL_DB_QUOTES: QuoteMaster[] = [
  {
    id: 'COT-4738',
    clientId: 'c1',
    contactId: 'ct1',
    marketId: 'ID-998877',
    status: 'Pendiente',
    docs: { oc: '', guia: '', factura: '' },
    executiveId: 'u1',
    createdAt: '2023-11-19T09:00:00Z'
  },
  {
    id: 'COT-1254',
    clientId: 'c2',
    contactId: 'ct2',
    marketId: 'MIN-2024-X',
    status: 'Aprobada',
    docs: { oc: 'OC-555', guia: 'GD-101', factura: '' },
    executiveId: 'u2',
    createdAt: '2023-10-15T14:30:00Z'
  }
];

const INITIAL_DB_ITEMS: QuoteItem[] = [
  {
    id: 'item-1',
    quoteId: 'COT-4738',
    itemNumber: 1,
    image: 'https://m.media-amazon.com/images/I/61+Q6Rh3OQL._AC_SL1500_.jpg',
    quantity: 500,
    description: 'Bolsa 100% Algodón GANESHA\nBolsa 100% Algodón natural de 150g/m2.\n• Tamaño: 25 x 30 cm aprox',
    unitPrice: 2800
  },
  {
    id: 'item-2',
    quoteId: 'COT-1254',
    itemNumber: 1,
    image: 'https://placehold.co/100x100/png?text=Casco',
    quantity: 50,
    description: 'Casco de Seguridad Blanco\nCertificado ANSI Z89.1',
    unitPrice: 15000
  },
  {
    id: 'item-3',
    quoteId: 'COT-1254',
    itemNumber: 2,
    image: 'https://placehold.co/100x100/png?text=Guante',
    quantity: 100,
    description: 'Guantes de Cuero Cabritilla\nPar',
    unitPrice: 3500
  }
];

const INITIAL_DB_COSTS: QuoteCost[] = [
  {
    id: 'cost-1',
    quoteId: 'COT-4738',
    itemNumber: 1,
    code: 'E71',
    provider: 'Promo Import',
    quantity: 502,
    unitCost: 962,
    discountPercent: 5.00
  },
  {
    id: 'cost-2',
    quoteId: 'COT-4738',
    itemNumber: 1,
    code: 'IMP-01',
    provider: 'Publibox',
    quantity: 50,
    unitCost: 13500,
    discountPercent: 0
  },
  {
    id: 'cost-3',
    quoteId: 'COT-1254',
    itemNumber: 1,
    code: 'SEC-01',
    provider: 'Seguridad Ind.',
    quantity: 50,
    unitCost: 8000,
    discountPercent: 10
  },
  {
    id: 'cost-4',
    quoteId: 'COT-1254',
    itemNumber: 2,
    code: 'SEC-02',
    provider: 'Guantes Chile',
    quantity: 100,
    unitCost: 1200,
    discountPercent: 0
  }
];


// --- Components ---

// Reusable Input Component
const EditableInput = ({ 
  value, 
  onChange, 
  type = "text", 
  className = "", 
  placeholder = "",
  align = "left",
  readOnly = false
}: { 
  value: string | number; 
  onChange: (val: any) => void; 
  type?: string; 
  className?: string;
  placeholder?: string;
  align?: "left" | "center" | "right";
  readOnly?: boolean;
}) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    readOnly={readOnly}
    className={`
      w-full bg-transparent border-b border-transparent outline-none px-2 py-1 text-slate-200 placeholder-slate-600
      text-${align} ${className}
      ${readOnly ? 'cursor-default text-slate-400' : 'hover:border-slate-600 focus:border-indigo-500 focus:bg-slate-800/50 transition-all'}
    `}
  />
);

// Helper for Status Badge Color
const getStatusColor = (status: QuoteStatus) => {
  switch(status) {
    case 'Aprobada': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
    case 'Facturada': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    case 'Rechazada': return 'bg-red-500/20 text-red-400 border-red-500/50';
    case 'Enviada': return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
    default: return 'bg-slate-700 text-slate-300 border-slate-600';
  }
};

export default function App() {
  // --- User / Auth State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // --- Database State (In-Memory Simulation) ---
  // We use refs for the "Backend" so it persists without triggering re-renders directly,
  // acting like an external server we query.
  const dbQuotesRef = useRef<QuoteMaster[]>(INITIAL_DB_QUOTES);
  const dbItemsRef = useRef<QuoteItem[]>(INITIAL_DB_ITEMS);
  const dbCostsRef = useRef<QuoteCost[]>(INITIAL_DB_COSTS);

  // --- App State ---
  const [activeQuoteId, setActiveQuoteId] = useState('COT-4738');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data loaded from mock DB based on activeQuoteId
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [costs, setCosts] = useState<QuoteCost[]>([]);
  
  const [taxRate, setTaxRate] = useState<number>(19);
  const [isSaving, setIsSaving] = useState(false);
  
  // Status & Docs State
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>('Pendiente');
  const [quoteDocs, setQuoteDocs] = useState<QuoteDocuments>({ oc: '', guia: '', factura: '' });
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  
  // Temporary State for Modal
  const [tempStatus, setTempStatus] = useState<QuoteStatus>('Pendiente');
  const [tempDocs, setTempDocs] = useState<QuoteDocuments>({ oc: '', guia: '', factura: '' });

  // Client Info State
  const [clientInfo, setClientInfo] = useState<ClientInfoState>({
    clientId: '',
    clientName: '',
    contactId: '',
    contactName: '',
    marketId: ''
  });

  const [executiveInfo, setExecutiveInfo] = useState<ExecutiveInfo>({
    name: '',
    email: '',
    phone: ''
  });

  // Form States for Adding (Quick Add Row)
  const [newItem, setNewItem] = useState<Partial<QuoteItem>>({ quantity: 1, unitPrice: 0, description: '' });
  const [newCost, setNewCost] = useState<Partial<QuoteCost>>({ quantity: 1, unitCost: 0, discountPercent: 0, provider: '', code: '', itemNumber: 1 });

  // --- Effects ---

  // Initialize by loading default quote
  useEffect(() => {
    if (currentUser) {
      loadQuoteData('COT-4738');
    }
  }, [currentUser]);

  // Auto-fill executive info when user logs in
  useEffect(() => {
    if (currentUser) {
      setExecutiveInfo({
        name: currentUser.name,
        email: currentUser.email,
        phone: currentUser.phone
      });
    }
  }, [currentUser]);

  // Filter contacts based on selected client
  const availableContacts = useMemo(() => {
    if (!clientInfo.clientId) return [];
    return MOCK_CONTACTS.filter(c => c.clientId === clientInfo.clientId);
  }, [clientInfo.clientId]);

  // --- Loading Logic ---

  const loadQuoteData = (quoteId: string) => {
    console.log(`Cargando cotización: ${quoteId}`);
    
    // 1. Find Master Record in DB Ref
    const quoteMaster = dbQuotesRef.current.find(q => q.id === quoteId);
    
    if (!quoteMaster) {
      alert(`Cotización ${quoteId} no encontrada en la base de datos simulada.`);
      return;
    }

    // 2. Set Header Info
    setActiveQuoteId(quoteMaster.id);
    setQuoteStatus(quoteMaster.status);
    setQuoteDocs(quoteMaster.docs);
    
    // 3. Set Client Info (Resolve relationships)
    const client = MOCK_CLIENTS.find(c => c.id === quoteMaster.clientId);
    const contact = MOCK_CONTACTS.find(c => c.id === quoteMaster.contactId);
    
    setClientInfo({
      clientId: quoteMaster.clientId,
      clientName: client?.name || '',
      contactId: quoteMaster.contactId,
      contactName: contact?.name || '',
      marketId: quoteMaster.marketId
    });

    // 4. Filter and Set Items (Relational: Item.quoteId === Quote.id)
    const relatedItems = dbItemsRef.current.filter(i => i.quoteId === quoteMaster.id);
    setItems(relatedItems); // We copy them to state for editing

    // 5. Filter and Set Costs (Relational: Cost.quoteId === Quote.id)
    const relatedCosts = dbCostsRef.current.filter(c => c.quoteId === quoteMaster.id);
    setCosts(relatedCosts); // We copy them to state for editing
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      // Try to load whatever ID was typed (case insensitive for better UX)
      const targetId = searchTerm.trim();
      // Check exact match first, then rough match
      const exactMatch = dbQuotesRef.current.find(q => q.id === targetId);
      if (exactMatch) {
        loadQuoteData(exactMatch.id);
      } else {
        // Try formatting as COT-XXXX if user just typed numbers
        const numericMatch = dbQuotesRef.current.find(q => q.id === `COT-${targetId}`);
        if (numericMatch) {
          loadQuoteData(numericMatch.id);
        } else {
           alert("No se encontró la cotización. Verifique el ID.");
        }
      }
    }
  };

  // --- Calculations ---

  const getCostsForItem = (itemNumber: number) => {
    return costs.filter(c => c.itemNumber === itemNumber);
  };

  const calculateItemFinancials = (item: QuoteItem) => {
    const revenue = item.quantity * item.unitPrice;
    
    const relatedCosts = getCostsForItem(item.itemNumber);
    const totalCost = relatedCosts.reduce((acc, cost) => {
      const costTotal = (cost.quantity * cost.unitCost) * (1 - (cost.discountPercent / 100));
      return acc + costTotal;
    }, 0);

    const margin = revenue - totalCost;
    const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;

    return { revenue, totalCost, margin, marginPercent };
  };

  const globalTotals = useMemo(() => {
    let totalRev = 0;
    let totalCost = 0;
    items.forEach(item => {
      const fins = calculateItemFinancials(item);
      totalRev += fins.revenue;
      totalCost += fins.totalCost;
    });

    const net = totalRev;
    const taxAmount = Math.round(net * (taxRate / 100));
    const totalWithTax = net + taxAmount;

    return {
      revenue: totalRev, // Neto
      cost: totalCost,
      margin: totalRev - totalCost,
      marginPercent: totalRev > 0 ? ((totalRev - totalCost) / totalRev) * 100 : 0,
      taxAmount,
      totalWithTax
    };
  }, [items, costs, taxRate]);

  // --- Handlers ---

  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    if (window.confirm("¿Estás seguro de cerrar sesión?")) {
      setCurrentUser(null);
    }
  };

  const handleClientChange = (clientId: string) => {
    const client = MOCK_CLIENTS.find(c => c.id === clientId);
    if (client) {
      setClientInfo({
        clientId: client.id,
        clientName: client.name,
        marketId: client.marketId || '',
        contactId: '',
        contactName: '' 
      });
    } else {
      setClientInfo({ clientId: '', clientName: '', marketId: '', contactId: '', contactName: '' });
    }
  };

  const handleContactChange = (contactId: string) => {
    const contact = MOCK_CONTACTS.find(c => c.id === contactId);
    if (contact) {
      setClientInfo(prev => ({
        ...prev,
        contactId: contact.id,
        contactName: contact.name
      }));
    }
  };

  const handleNewQuote = () => {
    if(window.confirm("¿Estás seguro de crear una nueva cotización? Se perderán los cambios no guardados.")) {
      const randomId = Math.floor(1000 + Math.random() * 9000);
      setActiveQuoteId(`COT-${randomId}`);
      setItems([]);
      setCosts([]);
      setClientInfo({ clientId: '', clientName: '', contactId: '', contactName: '', marketId: '' });
      setQuoteStatus('Pendiente');
      setQuoteDocs({ oc: '', guia: '', factura: '' });
    }
  };

  const handleSaveToDrive = async () => {
    setIsSaving(true);
    const timestamp = new Date().toISOString();
    
    // 1. Prepare the payload (Simulation of Sheets API structure)
    const payload = {
      driveConfig: DRIVE_DB_CONFIG, 
      fileTitle: `Cotización ${activeQuoteId} - ${clientInfo.clientName}`,
      createdBy: currentUser?.email,
      sheets: {
        'Maestro_Cotizaciones': [{
           id: activeQuoteId,
           fecha: timestamp,
           cliente: clientInfo.clientName,
           rut_cliente: MOCK_CLIENTS.find(c => c.id === clientInfo.clientId)?.rut || '',
           contacto: clientInfo.contactName,
           id_mercado_publico: clientInfo.marketId,
           ejecutivo_nombre: executiveInfo.name,
           ejecutivo_email: executiveInfo.email,
           estado: quoteStatus,
           oc: quoteDocs.oc,
           guia: quoteDocs.guia,
           factura: quoteDocs.factura,
           neto: globalTotals.revenue,
           iva: globalTotals.taxAmount,
           total: globalTotals.totalWithTax,
           costo_total: globalTotals.cost,
           margen: globalTotals.margin,
           margen_porcentaje: globalTotals.marginPercent
        }],
        'Items': items.map(i => ({
          ...i,
          quoteId: activeQuoteId,
          total: i.quantity * i.unitPrice
        })),
        'Costos': costs.map(c => ({
          ...c,
          quoteId: activeQuoteId,
          total: (c.quantity * c.unitCost) * (1 - c.discountPercent/100)
        }))
      }
    };

    console.log(`--- GUARDANDO DATOS EN DB SIMULADA ---`);
    console.log(payload);

    // 2. SIMULATE SAVING TO DATABASE (Updating Refs)
    
    // Update Master Quote
    const masterIndex = dbQuotesRef.current.findIndex(q => q.id === activeQuoteId);
    const newMasterRecord: QuoteMaster = {
      id: activeQuoteId,
      clientId: clientInfo.clientId,
      contactId: clientInfo.contactId,
      marketId: clientInfo.marketId,
      status: quoteStatus,
      docs: quoteDocs,
      executiveId: currentUser?.id || 'unknown',
      createdAt: masterIndex >= 0 ? dbQuotesRef.current[masterIndex].createdAt : timestamp
    };

    if (masterIndex >= 0) {
      dbQuotesRef.current[masterIndex] = newMasterRecord;
    } else {
      dbQuotesRef.current.push(newMasterRecord);
    }

    // Update Items (Delete old for this quote, add new)
    // Remove existing items for this quote
    dbItemsRef.current = dbItemsRef.current.filter(i => i.quoteId !== activeQuoteId);
    // Add current state items
    dbItemsRef.current.push(...items.map(i => ({ ...i, quoteId: activeQuoteId })));

    // Update Costs (Delete old, add new)
    dbCostsRef.current = dbCostsRef.current.filter(c => c.quoteId !== activeQuoteId);
    dbCostsRef.current.push(...costs.map(c => ({ ...c, quoteId: activeQuoteId })));

    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSaving(false);
    alert(`¡Cotización ${activeQuoteId} guardada exitosamente! Ahora puede buscarla por su ID.`);
  };

  const openStatusModal = () => {
    setTempStatus(quoteStatus);
    setTempDocs(quoteDocs);
    setIsStatusModalOpen(true);
  };

  const saveStatusChanges = () => {
    setQuoteStatus(tempStatus);
    setQuoteDocs(tempDocs);
    setIsStatusModalOpen(false);
  };

  const updateItem = (id: string, field: keyof QuoteItem, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const updateCost = (id: string, field: keyof QuoteCost, value: any) => {
    setCosts(costs.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleAddItem = () => {
    const nextItemNum = items.length > 0 ? Math.max(...items.map(i => i.itemNumber)) + 1 : 1;
    const itemToAdd: QuoteItem = {
      id: crypto.randomUUID(),
      quoteId: activeQuoteId,
      itemNumber: nextItemNum,
      image: 'https://placehold.co/100x100/png?text=Img', 
      quantity: newItem.quantity || 1,
      description: newItem.description || 'Nuevo Item',
      unitPrice: Number(newItem.unitPrice) || 0
    };
    setItems([...items, itemToAdd]);
    setNewItem({ quantity: 1, unitPrice: 0, description: '' });
  };

  const handleAddCost = () => {
    const costToAdd: QuoteCost = {
      id: crypto.randomUUID(),
      quoteId: activeQuoteId,
      itemNumber: Number(newCost.itemNumber) || 1,
      code: newCost.code || '',
      provider: newCost.provider || 'Nuevo Prov.',
      quantity: newCost.quantity || 1,
      unitCost: Number(newCost.unitCost) || 0,
      discountPercent: Number(newCost.discountPercent) || 0
    };
    setCosts([...costs, costToAdd]);
    setNewCost({ quantity: 1, unitCost: 0, discountPercent: 0, provider: '', code: '', itemNumber: 1 });
  };

  const deleteItem = (id: string) => setItems(items.filter(i => i.id !== id));
  const deleteCost = (id: string) => setCosts(costs.filter(c => c.id !== id));

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);

  const formatPercent = (val: number) => 
    `${val.toFixed(2)}%`;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/30">
               <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Cotizador Pro</h1>
            <p className="text-slate-400">Selecciona tu usuario para ingresar</p>
          </div>
          
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl overflow-hidden divide-y divide-slate-700">
            {MOCK_USERS.map(user => (
              <button 
                key={user.id}
                onClick={() => handleLogin(user)}
                className="w-full p-4 flex items-center gap-4 hover:bg-slate-700/50 transition-colors text-left group"
              >
                <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full border-2 border-slate-600 group-hover:border-indigo-500 transition-colors" />
                <div>
                  <div className="text-white font-medium group-hover:text-indigo-400 transition-colors">{user.name}</div>
                  <div className="text-sm text-slate-500">{user.role}</div>
                </div>
                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </button>
            ))}
          </div>
          
          <p className="text-center text-xs text-slate-600 mt-8">
             Versión 2.6.3 &bull; DB: {DRIVE_DB_CONFIG.folderName}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 pb-20 font-sans selection:bg-indigo-500/30">
      
      {/* TOP HEADER & SUMMARY */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40 shadow-lg">
        <div className="max-w-[1600px] mx-auto px-6 py-3">
          {/* Row 1: Title, Search & Actions */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="bg-indigo-600 p-2 rounded-lg shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Cotizador Pro</h1>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                   <form onSubmit={handleSearch} className="flex items-center gap-2">
                     <span>ID:</span>
                     <div className="relative">
                        <input 
                          type="text" 
                          value={activeQuoteId}
                          readOnly
                          className="bg-slate-900 border border-slate-600 rounded px-2 py-0.5 w-24 text-indigo-400 font-mono text-xs"
                        />
                     </div>
                     
                     {/* SEARCH BAR */}
                     <div className="relative flex items-center ml-4">
                       <input 
                         type="text" 
                         placeholder="Buscar ID..." 
                         value={searchTerm}
                         onChange={e => setSearchTerm(e.target.value)}
                         className="bg-slate-900 border border-slate-600 rounded-l px-2 py-1 w-28 text-xs focus:border-indigo-500 outline-none transition-all"
                       />
                       <button type="submit" className="bg-slate-700 border border-l-0 border-slate-600 rounded-r px-2 py-1 hover:bg-slate-600 transition-colors" title="Cargar Cotización">
                          <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                       </button>
                     </div>
                     <span className="text-[10px] text-slate-600 hidden sm:inline">(Ej: COT-4738, COT-1254)</span>
                   </form>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* User Profile */}
              <div className="flex items-center gap-3 pl-3 border-l border-slate-600/50 mr-3">
                 <div className="text-right hidden sm:block">
                    <div className="text-xs font-bold text-white">{currentUser.name}</div>
                    <div className="text-[10px] text-slate-400">{currentUser.role}</div>
                 </div>
                 <img src={currentUser.avatar} alt="User" className="w-8 h-8 rounded-full border border-slate-600" />
                 <button onClick={handleLogout} title="Cerrar Sesión" className="text-slate-500 hover:text-red-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                 </button>
              </div>

              {/* Status Button */}
              <button 
                onClick={openStatusModal}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-all hover:brightness-110 ${getStatusColor(quoteStatus)}`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
                </span>
                {quoteStatus}
              </button>

              {/* Save to Drive Button */}
              <button 
                onClick={handleSaveToDrive}
                disabled={isSaving}
                className={`
                  flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-all shadow-sm
                  ${isSaving ? 'opacity-70 cursor-wait' : ''}
                `}
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">Guardando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.479 10.092C19.267 6.141 16.006 3.5 12.5 3.5c-2.93 0-5.58 1.84-6.66 4.446C2.343 8.36 0 11.409 0 15c0 3.866 3.134 7 7 7h12c3.313 0 6-2.687 6-6 0-2.973-2.164-5.438-5.107-5.856l-.414-.052zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                    </svg>
                    <span className="hidden sm:inline">Drive</span>
                  </>
                )}
              </button>

              {/* New Quote Button */}
              <button 
                onClick={handleNewQuote}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Nueva</span>
              </button>
            </div>
          </div>

          {/* Row 2: Financial Summary Strip */}
          <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-3 flex flex-wrap items-center justify-between gap-6 text-sm">
             <div className="flex flex-col">
                <span className="text-slate-400 text-xs uppercase font-semibold tracking-wider">Venta (Neto)</span>
                <span className="text-white font-mono text-lg">{formatCurrency(globalTotals.revenue)}</span>
             </div>
             
             <div className="flex flex-col">
                <div className="flex items-center gap-1 text-slate-400 text-xs uppercase font-semibold tracking-wider">
                   <span>IVA ({taxRate}%)</span>
                   <button className="text-slate-500 hover:text-slate-300" onClick={() => {
                      const newRate = prompt("Ingrese nuevo % IVA", taxRate.toString());
                      if(newRate !== null) setTaxRate(Number(newRate));
                   }}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                   </button>
                </div>
                <span className="text-slate-200 font-mono text-lg">{formatCurrency(globalTotals.taxAmount)}</span>
             </div>

             <div className="h-8 w-px bg-slate-700 hidden md:block"></div>

             <div className="flex flex-col">
                <span className="text-emerald-400 text-xs uppercase font-bold tracking-wider">Total a Pagar</span>
                <span className="text-emerald-400 font-mono text-xl font-bold">{formatCurrency(globalTotals.totalWithTax)}</span>
             </div>

             <div className="flex-1"></div>

             <div className="flex gap-6 text-right border-l border-slate-700 pl-6">
                <div className="flex flex-col">
                   <span className="text-slate-500 text-xs uppercase font-semibold">Costo Total</span>
                   <span className="text-slate-300 font-mono">{formatCurrency(globalTotals.cost)}</span>
                </div>
                <div className="flex flex-col">
                   <span className="text-slate-500 text-xs uppercase font-semibold">Margen</span>
                   <div className="flex items-baseline gap-2">
                      <span className={`${globalTotals.margin >= 0 ? 'text-indigo-400' : 'text-red-400'} font-mono font-medium`}>
                         {formatCurrency(globalTotals.margin)}
                      </span>
                      <span className={`text-xs ${globalTotals.marginPercent >= 15 ? 'text-emerald-500' : 'text-amber-500'}`}>
                         ({formatPercent(globalTotals.marginPercent)})
                      </span>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-[1600px] mx-auto p-6 space-y-8">
        
        {/* Info Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Client Info Card */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-indigo-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              <h2 className="font-semibold text-slate-200">Información Cliente</h2>
              <span className="text-xs text-slate-500 ml-auto bg-slate-900 px-2 py-0.5 rounded" title="Fuente de Datos">
                {DRIVE_DB_CONFIG.accountsSheetName}
              </span>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-xs text-slate-500 font-medium uppercase">Cliente (Cuenta)</label>
                <div className="col-span-2">
                   <select 
                      value={clientInfo.clientId} 
                      onChange={(e) => handleClientChange(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm focus:border-indigo-500 outline-none"
                   >
                      <option value="">Seleccionar Cliente...</option>
                      {MOCK_CLIENTS.map(c => (
                         <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                   </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-xs text-slate-500 font-medium uppercase flex items-center gap-1">
                  Contacto 
                  {/* Indicator for Contact Source */}
                  <svg className="w-3 h-3 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
                     <title>{`Origen: ${DRIVE_DB_CONFIG.contactsSheetName}`}</title>
                     <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </label>
                <div className="col-span-2">
                  <select 
                      value={clientInfo.contactId} 
                      onChange={(e) => handleContactChange(e.target.value)}
                      disabled={!clientInfo.clientId}
                      className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm focus:border-indigo-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                      {!clientInfo.clientId ? (
                         <option value="">Primero seleccione un Cliente</option>
                      ) : availableContacts.length === 0 ? (
                         <option value="">Sin contactos asociados</option>
                      ) : (
                         <option value="">Seleccionar Contacto...</option>
                      )}
                      {availableContacts.map(c => (
                         <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                   </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-xs text-slate-500 font-medium uppercase">ID Mercado P.</label>
                <div className="col-span-2">
                  <EditableInput 
                    value={clientInfo.marketId} 
                    onChange={v => setClientInfo(prev => ({...prev, marketId: v}))} 
                    placeholder="ID Licitación" 
                    className={clientInfo.marketId ? "text-emerald-400" : ""}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Executive Info Card */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-pink-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              <h2 className="font-semibold text-slate-200">Ejecutiva/o Comercial</h2>
              <span className="text-xs text-slate-500 ml-auto bg-slate-900 px-2 py-0.5 rounded" title="Fuente: BD_Ecomoving">
                {DRIVE_DB_CONFIG.usersSheetName}
              </span>
            </div>
            <div className="space-y-3">
               <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-xs text-slate-500 font-medium uppercase">Nombre</label>
                <div className="col-span-2">
                  {/* Read only since it comes from user login */}
                  <EditableInput value={executiveInfo.name} onChange={() => {}} readOnly={true} className="text-slate-400 cursor-not-allowed" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-xs text-slate-500 font-medium uppercase">Email</label>
                <div className="col-span-2">
                   <EditableInput value={executiveInfo.email} onChange={() => {}} readOnly={true} className="text-slate-400 cursor-not-allowed" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-xs text-slate-500 font-medium uppercase">Teléfono</label>
                <div className="col-span-2">
                   <EditableInput value={executiveInfo.phone} onChange={() => {}} readOnly={true} className="text-slate-400 cursor-not-allowed" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table Section */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
             <h3 className="font-semibold text-slate-200 flex items-center gap-2">
               <span className="bg-indigo-500/20 text-indigo-400 p-1 rounded">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
               </span>
               Detalles Items
             </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700 bg-slate-900/30">
                  <th className="p-3 w-16 text-center">#</th>
                  <th className="p-3 w-24">Imagen</th>
                  <th className="p-3 w-24 text-center">Cant.</th>
                  <th className="p-3">Descripción</th>
                  <th className="p-3 w-32 text-right">Unitario</th>
                  <th className="p-3 w-32 text-right">Subtotal</th>
                  <th className="p-3 w-24 text-right">Margen</th>
                  <th className="p-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-300 divide-y divide-slate-700/50">
                {items.map((item) => {
                  const financials = calculateItemFinancials(item);
                  return (
                    <tr key={item.id} className="group hover:bg-slate-700/30 transition-colors">
                      <td className="p-3 text-center font-mono text-slate-500">{item.itemNumber}</td>
                      <td className="p-3">
                        <div className="w-16 h-16 bg-slate-700 rounded border border-slate-600 overflow-hidden">
                          <img src={item.image} alt="Product" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </td>
                      <td className="p-3">
                        <EditableInput type="number" align="center" value={item.quantity} onChange={(v) => updateItem(item.id, 'quantity', Number(v))} />
                      </td>
                      <td className="p-3">
                        <textarea 
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          className="w-full bg-transparent resize-none outline-none text-slate-300 placeholder-slate-600 focus:bg-slate-800/50 p-1 rounded h-full"
                          rows={3}
                        />
                      </td>
                      <td className="p-3">
                        <EditableInput type="number" align="right" value={item.unitPrice} onChange={(v) => updateItem(item.id, 'unitPrice', Number(v))} />
                      </td>
                      <td className="p-3 text-right font-mono text-slate-200">
                        {formatCurrency(financials.revenue)}
                      </td>
                      <td className="p-3 text-right">
                         <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${financials.marginPercent >= 20 ? 'bg-emerald-500/20 text-emerald-400' : financials.marginPercent > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                           {financials.marginPercent.toFixed(1)}%
                         </span>
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => deleteItem(item.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                
                {/* Add New Item Row */}
                <tr className="bg-slate-900/20 border-t-2 border-slate-700 border-dashed">
                  <td className="p-3 text-center text-slate-600">+</td>
                  <td className="p-3 text-xs text-slate-500 italic">Auto</td>
                  <td className="p-3">
                     <input type="number" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center text-xs" placeholder="1" />
                  </td>
                  <td className="p-3">
                     <input type="text" value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs" placeholder="Descripción del nuevo item..." />
                  </td>
                  <td className="p-3">
                     <input type="number" value={newItem.unitPrice} onChange={e => setNewItem({...newItem, unitPrice: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-right text-xs" placeholder="$0" />
                  </td>
                  <td colSpan={2} className="p-3 text-right">
                    <button onClick={handleAddItem} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded font-medium transition-colors">
                      Agregar Item
                    </button>
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Costs Table Section */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
             <h3 className="font-semibold text-slate-200 flex items-center gap-2">
               <span className="bg-emerald-500/20 text-emerald-400 p-1 rounded">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               </span>
               Detalles Costos
             </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700 bg-slate-900/30">
                   <th className="p-3 w-20 text-center">
                     Item #
                     <svg className="inline-block w-3 h-3 ml-1 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
                       <title>Item al que pertenece</title>
                       <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                     </svg>
                   </th>
                   <th className="p-3 w-24">Código</th>
                   <th className="p-3">Proveedor</th>
                   <th className="p-3 w-24 text-center">Cant.</th>
                   <th className="p-3 w-32 text-right">Costo Unit.</th>
                   <th className="p-3 w-24 text-right">Desc %</th>
                   <th className="p-3 w-32 text-right">Total</th>
                   <th className="p-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-300 divide-y divide-slate-700/50">
                {costs.map((cost) => {
                  const totalCost = (cost.quantity * cost.unitCost) * (1 - (cost.discountPercent / 100));
                  return (
                    <tr key={cost.id} className="group hover:bg-slate-700/30 transition-colors">
                      <td className="p-3 text-center">
                        <EditableInput align="center" value={cost.itemNumber} onChange={(v) => updateCost(cost.id, 'itemNumber', Number(v))} />
                      </td>
                      <td className="p-3">
                         <EditableInput value={cost.code} onChange={(v) => updateCost(cost.id, 'code', v)} />
                      </td>
                      <td className="p-3">
                         <span className="px-2 py-1 rounded bg-slate-700 text-xs text-slate-300 border border-slate-600">
                           <EditableInput value={cost.provider} onChange={(v) => updateCost(cost.id, 'provider', v)} className="!p-0 !border-0 focus:!bg-transparent" />
                         </span>
                      </td>
                      <td className="p-3">
                         <EditableInput type="number" align="center" value={cost.quantity} onChange={(v) => updateCost(cost.id, 'quantity', Number(v))} />
                      </td>
                      <td className="p-3">
                         <EditableInput type="number" align="right" value={cost.unitCost} onChange={(v) => updateCost(cost.id, 'unitCost', Number(v))} />
                      </td>
                      <td className="p-3">
                         <EditableInput type="number" align="right" value={cost.discountPercent} onChange={(v) => updateCost(cost.id, 'discountPercent', Number(v))} />
                      </td>
                      <td className="p-3 text-right font-mono text-slate-400">
                        {formatCurrency(totalCost)}
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => deleteCost(cost.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Add New Cost Row */}
                <tr className="bg-slate-900/20 border-t-2 border-slate-700 border-dashed">
                  <td className="p-3">
                     <input type="number" value={newCost.itemNumber} onChange={e => setNewCost({...newCost, itemNumber: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center text-xs" placeholder="1" />
                  </td>
                  <td className="p-3">
                     <input type="text" value={newCost.code} onChange={e => setNewCost({...newCost, code: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs" placeholder="COD" />
                  </td>
                  <td className="p-3">
                     <input type="text" value={newCost.provider} onChange={e => setNewCost({...newCost, provider: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs" placeholder="Proveedor" />
                  </td>
                  <td className="p-3">
                     <input type="number" value={newCost.quantity} onChange={e => setNewCost({...newCost, quantity: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center text-xs" placeholder="1" />
                  </td>
                  <td className="p-3">
                     <input type="number" value={newCost.unitCost} onChange={e => setNewCost({...newCost, unitCost: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-right text-xs" placeholder="$ Costo" />
                  </td>
                   <td className="p-3">
                     <input type="number" value={newCost.discountPercent} onChange={e => setNewCost({...newCost, discountPercent: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-right text-xs" placeholder="%" />
                  </td>
                  <td className="p-3 text-right text-slate-500 font-mono text-xs">$0</td>
                  <td className="p-3 text-center">
                    <button onClick={handleAddCost} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-2 py-1 rounded font-medium transition-colors shadow-sm shadow-emerald-500/20">
                      Agregar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </main>

      {/* STATUS MODAL */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-md overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
              <h3 className="font-bold text-white">Actualizar Estado</h3>
              <button onClick={() => setIsStatusModalOpen(false)} className="text-slate-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Estado Cotización</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Pendiente', 'Enviada', 'Aprobada', 'Rechazada', 'Facturada'] as QuoteStatus[]).map(s => (
                     <button
                        key={s}
                        onClick={() => setTempStatus(s)}
                        className={`px-3 py-2 rounded text-sm border transition-colors ${tempStatus === s 
                           ? 'bg-indigo-600 border-indigo-500 text-white' 
                           : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                     >
                        {s}
                     </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-700/50">
                 <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Orden de Compra (OC)</label>
                    <input 
                      type="text" 
                      value={tempDocs.oc} 
                      onChange={e => setTempDocs({...tempDocs, oc: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white outline-none focus:border-indigo-500"
                      placeholder="Ej: 4500123456"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Guía de Despacho</label>
                    <input 
                      type="text" 
                      value={tempDocs.guia} 
                      onChange={e => setTempDocs({...tempDocs, guia: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white outline-none focus:border-indigo-500"
                      placeholder="Número de guía"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Factura</label>
                    <input 
                      type="text" 
                      value={tempDocs.factura} 
                      onChange={e => setTempDocs({...tempDocs, factura: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white outline-none focus:border-indigo-500"
                      placeholder="Número de factura"
                    />
                 </div>
              </div>
            </div>

            <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex justify-end gap-3">
               <button 
                 onClick={() => setIsStatusModalOpen(false)} 
                 className="px-4 py-2 rounded text-sm font-medium text-slate-400 hover:text-white transition-colors"
               >
                 Cancelar
               </button>
               <button 
                 onClick={saveStatusChanges} 
                 className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors shadow-lg shadow-indigo-500/30"
               >
                 Guardar Cambios
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
