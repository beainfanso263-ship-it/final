import {
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

type Role = "admin" | "customer";
type OrderStage =
  | "Received"
  | "Washing"
  | "Drying"
  | "Folding"
  | "Ready for Pickup"
  | "Claimed"
  | "Cancelled";
type OrderStatus = "Pending" | "Running" | "Ready" | "Completed" | "Cancelled";
type MachineStatus = "Available" | "In Use" | "Maintenance" | "Cleaning" | "Out of Service";
type MachineType = "Washer" | "Dryer" | "Folding Station";

type AppUser = {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone: string;
  password: string;
  createdAt: string;
};

type Order = {
  id: string;
  customerId: string;
  customerName: string;
  kilograms: number;
  ratePerKilo: number;
  total: number;
  paymentMethod: "Cash" | "GCash" | "Card";
  paymentStatus: "Paid" | "Pay on pickup";
  stage: OrderStage;
  status: OrderStatus;
  machine: string;
  createdAt: string;
};

type Machine = {
  id: string;
  name: string;
  type: MachineType;
  capacityKg: number;
  status: MachineStatus;
  note: string;
};

type CustomerForm = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

type MachineForm = {
  name: string;
  type: MachineType;
  capacityKg: string;
  status: MachineStatus;
  note: string;
};

type LaundryForm = {
  kilograms: string;
  paymentMethod: "Cash" | "GCash" | "Card";
};

const USERS_KEY = "washmate-users";
const ORDERS_KEY = "washmate-orders";
const MACHINES_KEY = "washmate-machines";
const PRICE_KEY = "washmate-price-per-kilo";
const SESSION_KEY = "washmate-session";

const DEFAULT_PRICE_PER_KILO = 75;

const seedUsers: AppUser[] = [
  {
    id: "admin-1",
    role: "admin",
    name: "Washmate Admin",
    email: "admin@washmate.ph",
    phone: "0917 000 0000",
    password: "admin123",
    createdAt: "2026-01-05T08:00:00.000Z",
  },
  {
    id: "cust-1",
    role: "customer",
    name: "Maria Santos",
    email: "maria@washmate.ph",
    phone: "0917 111 2222",
    password: "wash123",
    createdAt: "2026-01-07T08:00:00.000Z",
  },
  {
    id: "cust-2",
    role: "customer",
    name: "Juan Dela Cruz",
    email: "juan@washmate.ph",
    phone: "0918 333 4444",
    password: "wash123",
    createdAt: "2026-01-09T08:00:00.000Z",
  },
];

const seedOrders: Order[] = [
  {
    id: "WM-1001",
    customerId: "cust-1",
    customerName: "Maria Santos",
    kilograms: 5.5,
    ratePerKilo: 75,
    total: 412.5,
    paymentMethod: "GCash",
    paymentStatus: "Paid",
    stage: "Washing",
    status: "Running",
    machine: "Washer 02",
    createdAt: "2026-02-10T09:20:00.000Z",
  },
  {
    id: "WM-1002",
    customerId: "cust-2",
    customerName: "Juan Dela Cruz",
    kilograms: 3,
    ratePerKilo: 75,
    total: 225,
    paymentMethod: "Cash",
    paymentStatus: "Pay on pickup",
    stage: "Received",
    status: "Pending",
    machine: "Not assigned",
    createdAt: "2026-02-10T10:10:00.000Z",
  },
  {
    id: "WM-1003",
    customerId: "cust-1",
    customerName: "Maria Santos",
    kilograms: 4.25,
    ratePerKilo: 75,
    total: 318.75,
    paymentMethod: "Card",
    paymentStatus: "Paid",
    stage: "Ready for Pickup",
    status: "Ready",
    machine: "Pickup shelf",
    createdAt: "2026-02-09T14:45:00.000Z",
  },
];

const seedMachines: Machine[] = [
  {
    id: "machine-1",
    name: "Washer 01",
    type: "Washer",
    capacityKg: 8,
    status: "Available",
    note: "Ready for the next batch",
  },
  {
    id: "machine-2",
    name: "Washer 02",
    type: "Washer",
    capacityKg: 10,
    status: "In Use",
    note: "Assigned to order WM-1001",
  },
  {
    id: "machine-3",
    name: "Dryer 01",
    type: "Dryer",
    capacityKg: 9,
    status: "Available",
    note: "Lint filter cleaned",
  },
  {
    id: "machine-4",
    name: "Dryer 02",
    type: "Dryer",
    capacityKg: 9,
    status: "Maintenance",
    note: "Technician check scheduled",
  },
  {
    id: "machine-5",
    name: "Folding Area",
    type: "Folding Station",
    capacityKg: 20,
    status: "Available",
    note: "Counter sanitized",
  },
];

const statusActions: Array<{ label: string; stage: OrderStage; status: OrderStatus; description: string }> = [
  {
    label: "Mark as washing",
    stage: "Washing",
    status: "Running",
    description: "Laundry is loaded into a washer.",
  },
  {
    label: "Mark as drying",
    stage: "Drying",
    status: "Running",
    description: "Laundry is transferred to a dryer.",
  },
  {
    label: "Mark as folding",
    stage: "Folding",
    status: "Running",
    description: "Staff is folding and packing the laundry.",
  },
  {
    label: "Ready for pickup",
    stage: "Ready for Pickup",
    status: "Ready",
    description: "Customer can collect the order.",
  },
  {
    label: "Mark as claimed",
    stage: "Claimed",
    status: "Completed",
    description: "Order is released to the customer.",
  },
  {
    label: "Cancel order",
    stage: "Cancelled",
    status: "Cancelled",
    description: "Order will no longer continue.",
  },
];

const stageOrder: OrderStage[] = ["Received", "Washing", "Drying", "Folding", "Ready for Pickup", "Claimed"];

const machineStatuses: MachineStatus[] = ["Available", "In Use", "Maintenance", "Cleaning", "Out of Service"];
const machineTypes: MachineType[] = ["Washer", "Dryer", "Folding Station"];

function loadStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveStored<T>(key: string, value: T) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 90 + 10)}`;
}

function formatPeso(amount: number) {
  return `PHP ${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function getNextActions(order: Order) {
  if (order.stage === "Cancelled" || order.stage === "Claimed") {
    return [];
  }

  if (order.stage === "Received") {
    return [statusActions[0], statusActions[5]];
  }

  if (order.stage === "Washing") {
    return [statusActions[1], statusActions[5]];
  }

  if (order.stage === "Drying") {
    return [statusActions[2], statusActions[5]];
  }

  if (order.stage === "Folding") {
    return [statusActions[3], statusActions[5]];
  }

  if (order.stage === "Ready for Pickup") {
    return [statusActions[4]];
  }

  return [];
}

function releaseMachine(machines: Machine[], machineName: string) {
  return machines.map((machine) => {
    if (machine.name !== machineName || machine.status !== "In Use") {
      return machine;
    }

    return {
      ...machine,
      status: "Available" as MachineStatus,
      note: "Ready after order transfer",
    };
  });
}

function LogoMark({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
        dark ? "bg-sky-500 text-white" : "bg-white/15 text-white ring-1 ring-white/30"
      }`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none">
        <rect x="8" y="7" width="32" height="34" rx="7" stroke="currentColor" strokeWidth="3" />
        <path d="M14 15h8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="24" cy="28" r="9" stroke="currentColor" strokeWidth="3" />
        <path
          className="animate-washer-spin"
          d="M18 28c4-5 8 5 12 0"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-sm font-semibold text-slate-700">{children}</label>;
}

function StatusPill({ status }: { status: OrderStatus | MachineStatus }) {
  const styles: Record<string, string> = {
    Pending: "bg-amber-100 text-amber-800 ring-amber-200",
    Running: "bg-sky-100 text-sky-800 ring-sky-200",
    Ready: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    Completed: "bg-slate-200 text-slate-800 ring-slate-300",
    Cancelled: "bg-rose-100 text-rose-800 ring-rose-200",
    Available: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    "In Use": "bg-sky-100 text-sky-800 ring-sky-200",
    Maintenance: "bg-orange-100 text-orange-800 ring-orange-200",
    Cleaning: "bg-violet-100 text-violet-800 ring-violet-200",
    "Out of Service": "bg-rose-100 text-rose-800 ring-rose-200",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ${styles[status]}`}>
      {status}
    </span>
  );
}

function StagePill({ stage }: { stage: OrderStage }) {
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{stage}</span>;
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 ${
        props.className ?? ""
      }`}
    />
  );
}

function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 ${
        props.className ?? ""
      }`}
    />
  );
}

function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-50 ${
        props.className ?? ""
      }`}
    />
  );
}

function SecondaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-sky-300 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100 ${
        props.className ?? ""
      }`}
    />
  );
}

function LoginScreen({
  users,
  onLogin,
  onRegister,
}: {
  users: AppUser[];
  onLogin: (email: string, password: string) => string | null;
  onRegister: (form: CustomerForm) => string | null;
}) {
  const [mode, setMode] = useState<"login" | "create">("login");
  const [email, setEmail] = useState("admin@washmate.ph");
  const [password, setPassword] = useState("admin123");
  const [registerForm, setRegisterForm] = useState<CustomerForm>({ name: "", email: "", phone: "", password: "" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const loginError = onLogin(email, password);
    setError(loginError ?? "");
  }

  function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (registerForm.password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const registerError = onRegister(registerForm);
    setError(registerError ?? "");
  }

  function useDemo(role: Role) {
    const demoUser = users.find((user) => user.role === role);
    if (!demoUser) {
      return;
    }
    setEmail(demoUser.email);
    setPassword(demoUser.password);
    setError("");
    setMode("login");
  }

  function switchMode(nextMode: "login" | "create") {
    setMode(nextMode);
    setError("");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <img
        src="/images/washmate-laundromat.jpg"
        alt="Modern laundromat with rows of washing machines"
        className="absolute inset-0 h-full w-full object-cover opacity-55 animate-hero-pan"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/78 to-sky-950/30" />
      <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <section className="animate-rise-in space-y-8">
          <div className="flex items-center gap-4">
            <LogoMark />
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.45em] text-sky-200">Web-Based</p>
              <h1 className="text-5xl font-black tracking-tight sm:text-7xl">Washmate</h1>
            </div>
          </div>
          <div className="max-w-2xl space-y-5">
            <p className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Laundromat System</p>
            <p className="max-w-xl text-base leading-8 text-slate-200 sm:text-lg">
              Book laundry by kilo, calculate peso totals automatically, update running order status, and manage customer
              accounts and machines from one online platform.
            </p>
          </div>
          <div className="grid max-w-xl grid-cols-3 gap-4 text-sm text-slate-200">
            <div className="border-l border-white/25 pl-4">
              <span className="block text-2xl font-black text-white">PHP</span>
              Per kilo pricing
            </div>
            <div className="border-l border-white/25 pl-4">
              <span className="block text-2xl font-black text-white">Live</span>
              Order actions
            </div>
            <div className="border-l border-white/25 pl-4">
              <span className="block text-2xl font-black text-white">Role</span>
              Admin and customer
            </div>
          </div>
        </section>

        <section className="animate-rise-in rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl shadow-slate-950/30 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.28em] text-sky-600">
                {mode === "login" ? "Login Form" : "Create Account"}
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">
                {mode === "login" ? "Access Washmate" : "Customer signup"}
              </h2>
            </div>
            <div className="hidden h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-700 sm:flex">
              <span className="animate-soft-pulse h-3 w-3 rounded-full bg-sky-500" />
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-full bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`rounded-full px-4 py-2 text-sm font-black transition ${
                mode === "login" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-sky-700"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => switchMode("create")}
              className={`rounded-full px-4 py-2 text-sm font-black transition ${
                mode === "create" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-sky-700"
              }`}
            >
              Create account
            </button>
          </div>

          {mode === "login" ? (
            <form onSubmit={submitLogin} className="space-y-4">
              <div className="space-y-2">
                <FieldLabel>Email address</FieldLabel>
                <TextInput value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
              </div>
              <div className="space-y-2">
                <FieldLabel>Password</FieldLabel>
                <TextInput
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  required
                />
              </div>
              {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
              <PrimaryButton type="submit" className="w-full">
                Sign in
              </PrimaryButton>
            </form>
          ) : (
            <form onSubmit={submitRegister} className="space-y-4">
              <div className="space-y-2">
                <FieldLabel>Full name</FieldLabel>
                <TextInput
                  value={registerForm.name}
                  onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })}
                  placeholder="Your full name"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Email</FieldLabel>
                  <TextInput
                    value={registerForm.email}
                    onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })}
                    type="email"
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Phone number</FieldLabel>
                  <TextInput
                    value={registerForm.phone}
                    onChange={(event) => setRegisterForm({ ...registerForm, phone: event.target.value })}
                    placeholder="09xx xxx xxxx"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Password</FieldLabel>
                  <TextInput
                    value={registerForm.password}
                    onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
                    type="password"
                    minLength={4}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Confirm password</FieldLabel>
                  <TextInput
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type="password"
                    minLength={4}
                    required
                  />
                </div>
              </div>
              {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
              <PrimaryButton type="submit" className="w-full">
                Create customer account
              </PrimaryButton>
            </form>
          )}

          {mode === "login" ? (
            <div className="mt-6 grid gap-3 border-t border-slate-100 pt-6 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => useDemo("admin")}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
              >
                Admin demo
                <span className="block text-xs font-semibold text-slate-500">admin@washmate.ph</span>
              </button>
              <button
                type="button"
                onClick={() => useDemo("customer")}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
              >
                Customer demo
                <span className="block text-xs font-semibold text-slate-500">maria@washmate.ph</span>
              </button>
            </div>
          ) : (
            <p className="mt-5 text-center text-sm font-semibold text-slate-500">
              New accounts are created as customer accounts and open the customer dashboard immediately.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function DashboardShell({
  currentUser,
  onLogout,
  children,
}: {
  currentUser: AppUser;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <LogoMark dark />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-600">Washmate</p>
              <h1 className="text-lg font-black tracking-tight sm:text-2xl">Laundromat System</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold">{currentUser.name}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{currentUser.role}</p>
            </div>
            <SecondaryButton onClick={onLogout}>Logout</SecondaryButton>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">{children}</div>
    </main>
  );
}

function AdminDashboard({
  currentUser,
  users,
  orders,
  machines,
  pricePerKilo,
  onLogout,
  onAddCustomer,
  onAdvanceOrder,
  onMachineStatusChange,
  onMachineNoteChange,
  onAddMachine,
  onPriceChange,
}: {
  currentUser: AppUser;
  users: AppUser[];
  orders: Order[];
  machines: Machine[];
  pricePerKilo: number;
  onLogout: () => void;
  onAddCustomer: (form: CustomerForm) => string | null;
  onAdvanceOrder: (orderId: string, stage: OrderStage, status: OrderStatus) => void;
  onMachineStatusChange: (machineId: string, status: MachineStatus) => void;
  onMachineNoteChange: (machineId: string, note: string) => void;
  onAddMachine: (form: MachineForm) => string | null;
  onPriceChange: (rate: number) => string | null;
}) {
  const [activeTab, setActiveTab] = useState<"orders" | "customers" | "machines" | "pricing">("orders");
  const [customerForm, setCustomerForm] = useState<CustomerForm>({ name: "", email: "", phone: "", password: "" });
  const [machineForm, setMachineForm] = useState<MachineForm>({
    name: "",
    type: "Washer",
    capacityKg: "8",
    status: "Available",
    note: "",
  });
  const [priceInput, setPriceInput] = useState(String(pricePerKilo));
  const [message, setMessage] = useState("");

  const customerUsers = users.filter((user) => user.role === "customer");
  const runningOrders = orders.filter((order) => order.status === "Running").length;
  const availableMachines = machines.filter((machine) => machine.status === "Available").length;

  function submitCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = onAddCustomer(customerForm);
    setMessage(result ?? "Customer account added successfully.");
    if (!result) {
      setCustomerForm({ name: "", email: "", phone: "", password: "" });
    }
  }

  function submitMachine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = onAddMachine(machineForm);
    setMessage(result ?? "Machine added successfully.");
    if (!result) {
      setMachineForm({ name: "", type: "Washer", capacityKg: "8", status: "Available", note: "" });
    }
  }

  function submitPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = onPriceChange(Number(priceInput));
    setMessage(result ?? "Price per kilo updated.");
  }

  return (
    <DashboardShell currentUser={currentUser} onLogout={onLogout}>
      <section className="animate-rise-in space-y-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-600">Admin Workspace</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Daily operations</h2>
            <p className="mt-3 max-w-3xl text-slate-600">
              Manage all orders, customer accounts, peso pricing, and machine availability. Running status is used for
              washing, drying, and folding actions.
            </p>
          </div>
          <p className="text-sm font-semibold text-slate-600">
            {runningOrders} running orders, {availableMachines} machines available, {customerUsers.length} customers
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {[
            ["orders", "All Orders"],
            ["customers", "Customers"],
            ["machines", "Maintenance"],
            ["pricing", "Price Per Kilo"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value as typeof activeTab)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                activeTab === value ? "bg-slate-950 text-white" : "bg-white text-slate-600 hover:text-sky-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {message ? (
          <div className="rounded-3xl border border-sky-100 bg-sky-50 px-5 py-4 text-sm font-semibold text-sky-800">
            {message}
          </div>
        ) : null}

        {activeTab === "orders" ? (
          <section className="space-y-8">
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="text-xl font-black">All laundry orders</h3>
                <p className="text-sm text-slate-500">Click an action to update the order stage and customer status.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[960px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Order</th>
                      <th className="px-5 py-4">Customer</th>
                      <th className="px-5 py-4">Kilo and total</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Machine</th>
                      <th className="px-5 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map((order) => (
                      <tr key={order.id} className="align-top">
                        <td className="px-5 py-5">
                          <p className="font-black text-slate-900">{order.id}</p>
                          <p className="text-xs text-slate-500">{formatDate(order.createdAt)}</p>
                          <p className="mt-2 text-xs font-semibold text-slate-500">{order.paymentMethod}</p>
                        </td>
                        <td className="px-5 py-5">
                          <p className="font-bold text-slate-900">{order.customerName}</p>
                          <p className="text-xs text-slate-500">{order.paymentStatus}</p>
                        </td>
                        <td className="px-5 py-5">
                          <p className="font-bold">{order.kilograms} kg</p>
                          <p className="text-slate-500">{formatPeso(order.ratePerKilo)} per kg</p>
                          <p className="mt-1 font-black text-sky-700">{formatPeso(order.total)}</p>
                        </td>
                        <td className="px-5 py-5">
                          <div className="flex flex-col items-start gap-2">
                            <StagePill stage={order.stage} />
                            <StatusPill status={order.status} />
                          </div>
                        </td>
                        <td className="px-5 py-5">
                          <p className="font-semibold text-slate-800">{order.machine}</p>
                        </td>
                        <td className="px-5 py-5">
                          <div className="flex max-w-xs flex-wrap gap-2">
                            {getNextActions(order).length ? (
                              getNextActions(order).map((action) => (
                                <button
                                  key={`${order.id}-${action.label}`}
                                  type="button"
                                  onClick={() => onAdvanceOrder(order.id, action.stage, action.status)}
                                  className={`rounded-full px-3 py-2 text-xs font-black transition hover:-translate-y-0.5 ${
                                    action.stage === "Cancelled"
                                      ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                                      : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                                  }`}
                                >
                                  {action.label}
                                </button>
                              ))
                            ) : (
                              <span className="text-sm font-semibold text-slate-400">No further action</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5">
              <h3 className="text-xl font-black">Recommended order action flow</h3>
              <p className="mt-1 text-sm text-slate-500">
                These are the admin actions and the customer-facing status they create.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {statusActions.map((action) => (
                  <div key={action.label} className="rounded-3xl bg-slate-50 p-4">
                    <p className="font-black text-slate-900">{action.label}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StagePill stage={action.stage} />
                      <StatusPill status={action.status} />
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{action.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "customers" ? (
          <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={submitCustomer} className="rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-xl font-black">Add customer account</h3>
              <p className="mt-1 text-sm text-slate-500">The new customer can use this email and password to login.</p>
              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <FieldLabel>Full name</FieldLabel>
                  <TextInput
                    value={customerForm.name}
                    onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Email</FieldLabel>
                  <TextInput
                    value={customerForm.email}
                    onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })}
                    type="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Phone number</FieldLabel>
                  <TextInput
                    value={customerForm.phone}
                    onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Password</FieldLabel>
                  <TextInput
                    value={customerForm.password}
                    onChange={(event) => setCustomerForm({ ...customerForm, password: event.target.value })}
                    type="password"
                    minLength={4}
                    required
                  />
                </div>
                <PrimaryButton type="submit" className="w-full">
                  Create customer
                </PrimaryButton>
              </div>
            </form>

            <div className="rounded-[2rem] border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="text-xl font-black">Customer records</h3>
                <p className="text-sm text-slate-500">Registered users with customer access.</p>
              </div>
              <div className="divide-y divide-slate-100">
                {customerUsers.map((customer) => (
                  <div key={customer.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <p className="font-black text-slate-900">{customer.name}</p>
                      <p className="text-sm text-slate-500">{customer.email}</p>
                      <p className="text-sm text-slate-500">{customer.phone}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-500">Joined {formatDate(customer.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "machines" ? (
          <section className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[2rem] border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="text-xl font-black">Machine maintenance manager</h3>
                <p className="text-sm text-slate-500">Set each machine to available, in use, maintenance, cleaning, or out of service.</p>
              </div>
              <div className="divide-y divide-slate-100">
                {machines.map((machine) => (
                  <div key={machine.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[1fr_180px_1.1fr] lg:items-center">
                    <div>
                      <p className="font-black text-slate-900">{machine.name}</p>
                      <p className="text-sm text-slate-500">
                        {machine.type} - {machine.capacityKg} kg capacity
                      </p>
                    </div>
                    <div className="space-y-2">
                      <StatusPill status={machine.status} />
                      <SelectInput
                        value={machine.status}
                        onChange={(event) => onMachineStatusChange(machine.id, event.target.value as MachineStatus)}
                      >
                        {machineStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </SelectInput>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Maintenance note</FieldLabel>
                      <TextInput value={machine.note} onChange={(event) => onMachineNoteChange(machine.id, event.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={submitMachine} className="rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-xl font-black">Add machine</h3>
              <p className="mt-1 text-sm text-slate-500">Use this for new washers, dryers, or folding stations.</p>
              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <FieldLabel>Machine name</FieldLabel>
                  <TextInput
                    value={machineForm.name}
                    onChange={(event) => setMachineForm({ ...machineForm, name: event.target.value })}
                    placeholder="Washer 03"
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FieldLabel>Type</FieldLabel>
                    <SelectInput
                      value={machineForm.type}
                      onChange={(event) => setMachineForm({ ...machineForm, type: event.target.value as MachineType })}
                    >
                      {machineTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Capacity kg</FieldLabel>
                    <TextInput
                      type="number"
                      min="1"
                      step="0.5"
                      value={machineForm.capacityKg}
                      onChange={(event) => setMachineForm({ ...machineForm, capacityKg: event.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Status</FieldLabel>
                  <SelectInput
                    value={machineForm.status}
                    onChange={(event) => setMachineForm({ ...machineForm, status: event.target.value as MachineStatus })}
                  >
                    {machineStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Note</FieldLabel>
                  <TextInput
                    value={machineForm.note}
                    onChange={(event) => setMachineForm({ ...machineForm, note: event.target.value })}
                    placeholder="Ready, under repair, needs cleaning"
                  />
                </div>
                <PrimaryButton type="submit" className="w-full">
                  Save machine
                </PrimaryButton>
              </div>
            </form>
          </section>
        ) : null}

        {activeTab === "pricing" ? (
          <section className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <form onSubmit={submitPrice} className="rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-xl font-black">Set peso price per kilo</h3>
              <p className="mt-1 text-sm text-slate-500">Customers will see this rate and totals will calculate automatically.</p>
              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <FieldLabel>Price per kilo in PHP</FieldLabel>
                  <TextInput
                    type="number"
                    min="1"
                    step="0.25"
                    value={priceInput}
                    onChange={(event) => setPriceInput(event.target.value)}
                    required
                  />
                </div>
                <PrimaryButton type="submit" className="w-full">
                  Update price
                </PrimaryButton>
              </div>
            </form>

            <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-300">Current rate</p>
              <p className="mt-4 text-5xl font-black tracking-tight">{formatPeso(pricePerKilo)}</p>
              <p className="mt-3 text-slate-300">per kilo for new laundry orders</p>
              <div className="mt-8 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                {[3, 5, 8].map((kilo) => (
                  <div key={kilo} className="rounded-3xl bg-white/10 p-4">
                    <p className="font-bold text-white">{kilo} kg load</p>
                    <p>{formatPeso(kilo * pricePerKilo)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </DashboardShell>
  );
}

function ProgressLine({ order }: { order: Order }) {
  if (order.stage === "Cancelled") {
    return <p className="text-sm font-bold text-rose-600">This order has been cancelled.</p>;
  }

  const activeIndex = Math.max(0, stageOrder.indexOf(order.stage));

  return (
    <div className="grid gap-2 sm:grid-cols-6">
      {stageOrder.map((stage, index) => {
        const isDone = index <= activeIndex;
        const isCurrent = index === activeIndex;
        return (
          <div key={stage} className="flex items-center gap-2 sm:block">
            <div
              className={`h-2 flex-1 rounded-full sm:mb-2 ${
                isDone ? "bg-sky-500" : "bg-slate-200"
              } ${isCurrent && order.status === "Running" ? "animate-soft-pulse" : ""}`}
            />
            <p className={`text-xs font-bold ${isDone ? "text-slate-900" : "text-slate-400"}`}>{stage}</p>
          </div>
        );
      })}
    </div>
  );
}

function CustomerDashboard({
  currentUser,
  orders,
  pricePerKilo,
  onLogout,
  onCreateOrder,
}: {
  currentUser: AppUser;
  orders: Order[];
  pricePerKilo: number;
  onLogout: () => void;
  onCreateOrder: (form: LaundryForm) => string | null;
}) {
  const [activeTab, setActiveTab] = useState<"book" | "orders" | "rates">("book");
  const [laundryForm, setLaundryForm] = useState<LaundryForm>({ kilograms: "", paymentMethod: "Cash" });
  const [message, setMessage] = useState("");

  const customerOrders = orders.filter((order) => order.customerId === currentUser.id);
  const kilograms = Number(laundryForm.kilograms);
  const total = Number.isFinite(kilograms) && kilograms > 0 ? roundMoney(kilograms * pricePerKilo) : 0;

  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = onCreateOrder(laundryForm);
    setMessage(result ?? "Laundry order submitted. Admin can now mark it as washing.");
    if (!result) {
      setLaundryForm({ kilograms: "", paymentMethod: "Cash" });
    }
  }

  return (
    <DashboardShell currentUser={currentUser} onLogout={onLogout}>
      <section className="animate-rise-in space-y-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-600">Customer Portal</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Book and track laundry</h2>
            <p className="mt-3 max-w-3xl text-slate-600">
              View the current peso price per kilo, get an automatic total, and follow your order status from received to
              claimed.
            </p>
          </div>
          <p className="text-sm font-semibold text-slate-600">Current price: {formatPeso(pricePerKilo)} per kg</p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {[
            ["book", "Book Laundry"],
            ["orders", "My Orders"],
            ["rates", "Rate Calculator"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value as typeof activeTab)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                activeTab === value ? "bg-slate-950 text-white" : "bg-white text-slate-600 hover:text-sky-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {message ? (
          <div className="rounded-3xl border border-sky-100 bg-sky-50 px-5 py-4 text-sm font-semibold text-sky-800">
            {message}
          </div>
        ) : null}

        {activeTab === "book" ? (
          <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={submitOrder} className="rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-xl font-black">Create laundry order</h3>
              <p className="mt-1 text-sm text-slate-500">Enter kilos and the total will calculate automatically in PHP.</p>
              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <FieldLabel>Kilograms</FieldLabel>
                  <TextInput
                    type="number"
                    min="0.5"
                    step="0.25"
                    value={laundryForm.kilograms}
                    onChange={(event) => setLaundryForm({ ...laundryForm, kilograms: event.target.value })}
                    placeholder="Example: 4.5"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Payment method</FieldLabel>
                  <SelectInput
                    value={laundryForm.paymentMethod}
                    onChange={(event) =>
                      setLaundryForm({ ...laundryForm, paymentMethod: event.target.value as LaundryForm["paymentMethod"] })
                    }
                  >
                    <option value="Cash">Cash</option>
                    <option value="GCash">GCash</option>
                    <option value="Card">Card</option>
                  </SelectInput>
                </div>
                <PrimaryButton type="submit" className="w-full">
                  Submit order
                </PrimaryButton>
              </div>
            </form>

            <div className="overflow-hidden rounded-[2rem] bg-slate-950 text-white">
              <div className="relative min-h-full p-6 sm:p-8">
                <div className="absolute right-8 top-8 h-32 w-32 rounded-full bg-sky-400/20 blur-2xl" />
                <div className="relative">
                  <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-300">Automatic calculation</p>
                  <p className="mt-4 text-5xl font-black tracking-tight">{formatPeso(total)}</p>
                  <p className="mt-3 text-slate-300">
                    {kilograms > 0 ? `${kilograms} kg x ${formatPeso(pricePerKilo)} per kg` : "Enter kilos to see the total."}
                  </p>
                  <div className="mt-8 space-y-4 border-t border-white/10 pt-6">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-slate-300">Price per kilo</span>
                      <span className="font-black">{formatPeso(pricePerKilo)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-slate-300">Order status after submit</span>
                      <span className="font-black">Pending</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-slate-300">First admin action</span>
                      <span className="font-black">Mark as washing</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "orders" ? (
          <section className="space-y-4">
            {customerOrders.length ? (
              customerOrders.map((order) => (
                <article key={order.id} className="rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6">
                  <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black">{order.id}</h3>
                        <StagePill stage={order.stage} />
                        <StatusPill status={order.status} />
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {formatDate(order.createdAt)} - {order.kilograms} kg - {order.machine}
                      </p>
                    </div>
                    <div className="text-left lg:text-right">
                      <p className="text-sm text-slate-500">Total</p>
                      <p className="text-2xl font-black text-sky-700">{formatPeso(order.total)}</p>
                      <p className="text-sm font-semibold text-slate-500">{order.paymentStatus}</p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <ProgressLine order={order} />
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center">
                <h3 className="text-xl font-black">No orders yet</h3>
                <p className="mt-2 text-slate-500">Create your first laundry order from the Book Laundry tab.</p>
              </div>
            )}
          </section>
        ) : null}

        {activeTab === "rates" ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6">
            <h3 className="text-xl font-black">Customer price list</h3>
            <p className="mt-1 text-sm text-slate-500">The laundromat charges by weight. The current rate is visible below.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 3, 5, 10].map((kilo) => (
                <div key={kilo} className="rounded-3xl bg-slate-50 p-5">
                  <p className="text-sm font-bold text-slate-500">{kilo} kg</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">{formatPeso(kilo * pricePerKilo)}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </DashboardShell>
  );
}

export default function App() {
  const [users, setUsers] = useState<AppUser[]>(() => loadStored(USERS_KEY, seedUsers));
  const [orders, setOrders] = useState<Order[]>(() => loadStored(ORDERS_KEY, seedOrders));
  const [machines, setMachines] = useState<Machine[]>(() => loadStored(MACHINES_KEY, seedMachines));
  const [pricePerKilo, setPricePerKilo] = useState(() => loadStored(PRICE_KEY, DEFAULT_PRICE_PER_KILO));
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage.getItem(SESSION_KEY);
  });

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );

  useEffect(() => saveStored(USERS_KEY, users), [users]);
  useEffect(() => saveStored(ORDERS_KEY, orders), [orders]);
  useEffect(() => saveStored(MACHINES_KEY, machines), [machines]);
  useEffect(() => saveStored(PRICE_KEY, pricePerKilo), [pricePerKilo]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (currentUserId) {
      window.localStorage.setItem(SESSION_KEY, currentUserId);
    } else {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId && !users.some((user) => user.id === currentUserId)) {
      setCurrentUserId(null);
    }
  }, [currentUserId, users]);

  function handleLogin(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const matchingUser = users.find(
      (user) => user.email.toLowerCase() === normalizedEmail && user.password === password,
    );

    if (!matchingUser) {
      return "Invalid email or password. Use a demo account, an admin-created account, or create a new account.";
    }

    setCurrentUserId(matchingUser.id);
    return null;
  }

  function handleLogout() {
    setCurrentUserId(null);
  }

  function handleAddCustomer(form: CustomerForm) {
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    const password = form.password.trim();

    if (!name || !email || !phone || !password) {
      return "Please complete all customer fields.";
    }

    if (users.some((user) => user.email.toLowerCase() === email)) {
      return "A user with this email already exists.";
    }

    setUsers((current) => [
      ...current,
      {
        id: makeId("cust"),
        role: "customer",
        name,
        email,
        phone,
        password,
        createdAt: new Date().toISOString(),
      },
    ]);

    return null;
  }

  function handleRegisterCustomer(form: CustomerForm) {
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    const password = form.password.trim();

    if (!name || !email || !phone || !password) {
      return "Please complete all account fields.";
    }

    if (password.length < 4) {
      return "Password must be at least 4 characters.";
    }

    if (users.some((user) => user.email.toLowerCase() === email)) {
      return "A user with this email already exists. Login instead.";
    }

    const newUser: AppUser = {
      id: makeId("cust"),
      role: "customer",
      name,
      email,
      phone,
      password,
      createdAt: new Date().toISOString(),
    };

    setUsers((current) => [...current, newUser]);
    setCurrentUserId(newUser.id);
    return null;
  }

  function handleAddMachine(form: MachineForm) {
    const capacityKg = Number(form.capacityKg);
    const name = form.name.trim();

    if (!name || !Number.isFinite(capacityKg) || capacityKg <= 0) {
      return "Please enter a valid machine name and capacity.";
    }

    if (machines.some((machine) => machine.name.toLowerCase() === name.toLowerCase())) {
      return "A machine with this name already exists.";
    }

    setMachines((current) => [
      ...current,
      {
        id: makeId("machine"),
        name,
        type: form.type,
        capacityKg,
        status: form.status,
        note: form.note.trim() || "No note",
      },
    ]);

    return null;
  }

  function handlePriceChange(rate: number) {
    if (!Number.isFinite(rate) || rate <= 0) {
      return "Enter a valid peso price per kilo.";
    }
    setPricePerKilo(roundMoney(rate));
    return null;
  }

  function handleMachineStatusChange(machineId: string, status: MachineStatus) {
    setMachines((current) =>
      current.map((machine) =>
        machine.id === machineId
          ? {
              ...machine,
              status,
              note: status === "Maintenance" ? "Under maintenance" : machine.note,
            }
          : machine,
      ),
    );
  }

  function handleMachineNoteChange(machineId: string, note: string) {
    setMachines((current) => current.map((machine) => (machine.id === machineId ? { ...machine, note } : machine)));
  }

  function handleAdvanceOrder(orderId: string, stage: OrderStage, status: OrderStatus) {
    const targetOrder = orders.find((order) => order.id === orderId);
    if (!targetOrder) {
      return;
    }

    let nextMachine = targetOrder.machine;
    let nextMachines = releaseMachine(machines, targetOrder.machine);

    if (stage === "Washing") {
      const washer = nextMachines.find((machine) => machine.type === "Washer" && machine.status === "Available");
      nextMachine = washer ? washer.name : "Waiting for washer";
      if (washer) {
        nextMachines = nextMachines.map((machine) =>
          machine.id === washer.id
            ? { ...machine, status: "In Use", note: `Assigned to order ${targetOrder.id}` }
            : machine,
        );
      }
    } else if (stage === "Drying") {
      const dryer = nextMachines.find((machine) => machine.type === "Dryer" && machine.status === "Available");
      nextMachine = dryer ? dryer.name : "Waiting for dryer";
      if (dryer) {
        nextMachines = nextMachines.map((machine) =>
          machine.id === dryer.id ? { ...machine, status: "In Use", note: `Assigned to order ${targetOrder.id}` } : machine,
        );
      }
    } else if (stage === "Folding") {
      nextMachine = "Folding area";
    } else if (stage === "Ready for Pickup") {
      nextMachine = "Pickup shelf";
    } else if (stage === "Claimed" || stage === "Cancelled") {
      nextMachine = stage;
    }

    setMachines(nextMachines);
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, stage, status, machine: nextMachine } : order)),
    );
  }

  function handleCreateOrder(form: LaundryForm) {
    if (!currentUser) {
      return "Please login again.";
    }

    const kilograms = Number(form.kilograms);
    if (!Number.isFinite(kilograms) || kilograms <= 0) {
      return "Enter a valid laundry weight in kilos.";
    }

    const orderTotal = roundMoney(kilograms * pricePerKilo);
    const order: Order = {
      id: makeId("WM"),
      customerId: currentUser.id,
      customerName: currentUser.name,
      kilograms,
      ratePerKilo: pricePerKilo,
      total: orderTotal,
      paymentMethod: form.paymentMethod,
      paymentStatus: form.paymentMethod === "Cash" ? "Pay on pickup" : "Paid",
      stage: "Received",
      status: "Pending",
      machine: "Not assigned",
      createdAt: new Date().toISOString(),
    };

    setOrders((current) => [order, ...current]);
    return null;
  }

  if (!currentUser) {
    return <LoginScreen users={users} onLogin={handleLogin} onRegister={handleRegisterCustomer} />;
  }

  if (currentUser.role === "admin") {
    return (
      <AdminDashboard
        currentUser={currentUser}
        users={users}
        orders={orders}
        machines={machines}
        pricePerKilo={pricePerKilo}
        onLogout={handleLogout}
        onAddCustomer={handleAddCustomer}
        onAdvanceOrder={handleAdvanceOrder}
        onMachineStatusChange={handleMachineStatusChange}
        onMachineNoteChange={handleMachineNoteChange}
        onAddMachine={handleAddMachine}
        onPriceChange={handlePriceChange}
      />
    );
  }

  return (
    <CustomerDashboard
      currentUser={currentUser}
      orders={orders}
      pricePerKilo={pricePerKilo}
      onLogout={handleLogout}
      onCreateOrder={handleCreateOrder}
    />
  );
}