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
  username?: string;
  phone: string;
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
  paymentStatus: "Paid" | "Pay on pickup" | "Refunded";
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

type BootstrapData = {
  users: AppUser[];
  orders: Order[];
  machines: Machine[];
  pricePerKilo: number;
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

type LoginResponse = {
  success: boolean;
  user: AppUser;
  message?: string;
};

type RegisterResponse = {
  success: boolean;
  user: AppUser;
  message?: string;
};

type OrderResponse = {
  success: boolean;
  order: Order;
  message?: string;
};

const API_BASE_URL = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || "").replace(/\/$/, "");

const statusActions: Array<{ label: string; stage: OrderStage; status: OrderStatus; description: string }> = [
  {
    label: "Mark as washing",
    stage: "Washing",
    status: "Running",
    description: "Laundry is loaded into a washer. Customer sees Running.",
  },
  {
    label: "Mark as drying",
    stage: "Drying",
    status: "Running",
    description: "Laundry is transferred to a dryer. Customer still sees Running.",
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

class ApiError extends Error {
  method: string;
  status: number;
  traceId: string;
  url: string;

  constructor(message: string, details: { method: string; status: number; traceId: string; url: string }) {
    super(message);
    this.name = "ApiError";
    this.method = details.method;
    this.status = details.status;
    this.traceId = details.traceId;
    this.url = details.url;
  }
}

function makeTraceId() {
  return `web-${Date.now().toString(36)}-${Math.floor(Math.random() * 900 + 100)}`;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method || "GET";
  const traceId = makeTraceId();
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");
  headers.set("X-Trace-Id", traceId);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(url, { ...options, method, headers });
    const responseTraceId = response.headers.get("X-Trace-Id") || traceId;
    const text = await response.text();
    const payload = text ? safeJsonParse(text) : null;

    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && "message" in payload
          ? String(payload.message)
          : payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : `Request failed with status ${response.status}`;

      throw new ApiError(message, { method, status: response.status, traceId: responseTraceId, url });
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(error instanceof Error ? error.message : "Network request failed", {
      method,
      status: 0,
      traceId,
      url,
    });
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return { error: value.slice(0, 240) };
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return `${error.message} [${error.method} ${error.url}, status ${error.status || "network"}, trace ${error.traceId}]`;
  }

  return error instanceof Error ? error.message : "Unexpected error";
}

function formatPeso(amount: number) {
  return `PHP ${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
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
      className={`rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-sky-300 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50 ${
        props.className ?? ""
      }`}
    />
  );
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

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center">
      <h3 className="text-xl font-black text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </div>
  );
}

function ApiAlert({ error, onRefresh }: { error: string; onRefresh?: () => void }) {
  if (!error) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
      <p className="text-sm font-black uppercase tracking-[0.24em]">Connection or database error</p>
      <p className="mt-2 break-words text-sm font-semibold">{error}</p>
      {onRefresh ? (
        <button type="button" onClick={onRefresh} className="mt-4 text-sm font-black text-rose-900 underline">
          Retry API request
        </button>
      ) : null}
    </div>
  );
}

function ConnectionPanel({
  lastSync,
  error,
  onRefresh,
  loading,
}: {
  lastSync: string | null;
  error: string;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-sky-600">washmate data source</p>
          <p className="mt-2 text-sm text-slate-600">
            API base: <span className="font-bold text-slate-900">{API_BASE_URL || "same origin"}</span>
          </p>
          <p className="text-sm text-slate-600">
            Last sync: <span className="font-bold text-slate-900">{lastSync ? new Date(lastSync).toLocaleString() : "not yet synced"}</span>
          </p>
          <p className={`mt-2 text-sm font-bold ${error ? "text-rose-600" : "text-emerald-600"}`}>
            {error ? "Live database sync needs attention" : "Showing live records from the API"}
          </p>
        </div>
        <SecondaryButton type="button" onClick={onRefresh} disabled={loading}>
          {loading ? "Syncing..." : "Refresh records"}
        </SecondaryButton>
      </div>
    </div>
  );
}

function LoginScreen({
  onLogin,
  onRegister,
  apiError,
  onRefresh,
  loading,
}: {
  onLogin: (email: string, password: string) => Promise<string | null>;
  onRegister: (form: CustomerForm) => Promise<string | null>;
  apiError: string;
  onRefresh: () => void;
  loading: boolean;
}) {
  const [mode, setMode] = useState<"login" | "create">("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState<CustomerForm>({ name: "", email: "", phone: "", password: "" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function switchMode(nextMode: "login" | "create") {
    setMode(nextMode);
    setFormError("");
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const error = await onLogin(loginForm.email, loginForm.password);
    setFormError(error ?? "");
    setSubmitting(false);
  }

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (registerForm.password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const error = await onRegister(registerForm);
    setFormError(error ?? "");
    setSubmitting(false);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <img
        src="/images/washmate-laundromat.jpg"
        alt="Modern laundromat with rows of washing machines"
        className="absolute inset-0 h-full w-full object-cover opacity-55 animate-hero-pan"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-sky-950/35" />
      <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <section className="animate-rise-in space-y-8">
          <div className="flex items-center gap-4">
            <LogoMark />
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.45em] text-sky-200">Database-backed</p>
              <h1 className="text-5xl font-black tracking-tight sm:text-7xl">Washmate</h1>
            </div>
          </div>
          <div className="max-w-2xl space-y-5">
            <p className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Laundromat System</p>
            <p className="max-w-xl text-base leading-8 text-slate-200 sm:text-lg">
              Login, customer accounts, orders, machine status, and price per kilo are loaded from your washmate.
            </p>
          </div>
          <div className="max-w-xl border-l border-white/25 pl-5 text-sm text-slate-200">
            <span className="block text-2xl font-black text-white">Washmate records</span>
            If a table is empty, this dashboard will show an empty state instead of sample data.
          </div>
        </section>

        <section className="animate-rise-in rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl shadow-slate-950/30 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.28em] text-sky-600">
                {mode === "login" ? "Login Form" : "Create Account"}
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">
                {mode === "login" ? "Access dashboard" : "Customer signup"}
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

          <ApiAlert error={apiError} onRefresh={onRefresh} />

          {mode === "login" ? (
            <form onSubmit={submitLogin} className="mt-5 space-y-4">
              <div className="space-y-2">
                <FieldLabel>Email or username from accounts table</FieldLabel>
                <TextInput
                  value={loginForm.email}
                  onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                  type="text"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Password</FieldLabel>
                <TextInput
                  value={loginForm.password}
                  onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              {formError ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{formError}</p> : null}
              <PrimaryButton type="submit" disabled={submitting || loading} className="w-full">
                {submitting ? "Checking" : "Sign in"}
              </PrimaryButton>
            </form>
          ) : (
            <form onSubmit={submitRegister} className="mt-5 space-y-4">
              <div className="space-y-2">
                <FieldLabel>Full name</FieldLabel>
                <TextInput
                  value={registerForm.name}
                  onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })}
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
                    required
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Phone number</FieldLabel>
                  <TextInput
                    value={registerForm.phone}
                    onChange={(event) => setRegisterForm({ ...registerForm, phone: event.target.value })}
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
              {formError ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{formError}</p> : null}
              <PrimaryButton type="submit" disabled={submitting || loading} className="w-full">
                {submitting ? "Saving..." : "Create customer account"}
              </PrimaryButton>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function DashboardShell({
  currentUser,
  onLogout,
  onRefresh,
  loading,
  children,
}: {
  currentUser: AppUser;
  onLogout: () => void;
  onRefresh: () => void;
  loading: boolean;
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
              <h1 className="text-lg font-black tracking-tight sm:text-2xl">Live Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SecondaryButton type="button" onClick={onRefresh} disabled={loading} className="hidden sm:inline-flex">
              {loading ? "Syncing" : "Sync"}
            </SecondaryButton>
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
  apiError,
  lastSync,
  loading,
  onLogout,
  onRefresh,
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
  apiError: string;
  lastSync: string | null;
  loading: boolean;
  onLogout: () => void;
  onRefresh: () => void;
  onAddCustomer: (form: CustomerForm) => Promise<string | null>;
  onAdvanceOrder: (order: Order, stage: OrderStage, status: OrderStatus) => Promise<string | null>;
  onMachineStatusChange: (machine: Machine, status: MachineStatus) => Promise<string | null>;
  onMachineNoteChange: (machine: Machine, note: string) => Promise<string | null>;
  onAddMachine: (form: MachineForm) => Promise<string | null>;
  onPriceChange: (rate: number) => Promise<string | null>;
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setPriceInput(String(pricePerKilo)), [pricePerKilo]);

  const customerUsers = users.filter((user) => user.role === "customer");
  const runningOrders = orders.filter((order) => order.status === "Running").length;
  const availableMachines = machines.filter((machine) => machine.status === "Available").length;

  async function submitCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const result = await onAddCustomer(customerForm);
    setSubmitting(false);
    setMessage(result ?? "Customer account saved.");
    if (!result) {
      setCustomerForm({ name: "", email: "", phone: "", password: "" });
    }
  }

  async function submitMachine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const result = await onAddMachine(machineForm);
    setSubmitting(false);
    setMessage(result ?? "Machine saved.");
    if (!result) {
      setMachineForm({ name: "", type: "Washer", capacityKg: "8", status: "Available", note: "" });
    }
  }

  async function submitPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const result = await onPriceChange(Number(priceInput));
    setSubmitting(false);
    setMessage(result ?? "Price per kilo updated.");
  }

  return (
    <DashboardShell currentUser={currentUser} onLogout={onLogout} onRefresh={onRefresh} loading={loading}>
      <section className="animate-rise-in space-y-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-600">Admin Workspace</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Washmate control room</h2>
            <p className="mt-3 max-w-3xl text-slate-600">
             
            </p>
          </div>
          <p className="text-sm font-semibold text-slate-600">
            {runningOrders} running orders, {availableMachines} available machines, {customerUsers.length} customers
          </p>
        </div>

        <ApiAlert error={apiError} onRefresh={onRefresh} />
        <ConnectionPanel lastSync={lastSync} error={apiError} onRefresh={onRefresh} loading={loading} />

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
          <AdminOrders orders={orders} onAdvanceOrder={onAdvanceOrder} setMessage={setMessage} />
        ) : null}

        {activeTab === "customers" ? (
          <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={submitCustomer} className="rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-xl font-black">Add customer account</h3>
              <p className="mt-1 text-sm text-slate-500">This inserts a new customer into the accounts table.</p>
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
                <PrimaryButton type="submit" disabled={submitting || loading} className="w-full">
                  Create customer 
                </PrimaryButton>
              </div>
            </form>

            <div className="rounded-[2rem] border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="text-xl font-black">Customer records</h3>
                <p className="text-sm text-slate-500">Rows from accounts where role is customer.</p>
              </div>
              {customerUsers.length ? (
                <div className="divide-y divide-slate-100">
                  {customerUsers.map((customer) => (
                    <div key={customer.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div>
                        <p className="font-black text-slate-900">{customer.name}</p>
                        <p className="text-sm text-slate-500">{customer.email}</p>
                        <p className="text-sm text-slate-500">{customer.phone || "No phone recorded"}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-500">Joined {formatDate(customer.createdAt)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-5">
                  <EmptyState title="No customer rows" text="Add a customer or insert records into the accounts table." />
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "machines" ? (
          <section className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[2rem] border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="text-xl font-black">Machine maintenance manager</h3>
                <p className="text-sm text-slate-500">Rows from the machines table.</p>
              </div>
              {machines.length ? (
                <div className="divide-y divide-slate-100">
                  {machines.map((machine) => (
                    <MachineRow
                      key={machine.id}
                      machine={machine}
                      loading={loading}
                      onStatusChange={onMachineStatusChange}
                      onNoteSave={onMachineNoteChange}
                      setMessage={setMessage}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-5">
                  <EmptyState title="No machine rows" text="Add machines here or insert them into the machines table." />
                </div>
              )}
            </div>

            <form onSubmit={submitMachine} className="rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-xl font-black">Add machine</h3>
              <p className="mt-1 text-sm text-slate-500">This creates a new row in the machines table.</p>
              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <FieldLabel>Machine name</FieldLabel>
                  <TextInput
                    value={machineForm.name}
                    onChange={(event) => setMachineForm({ ...machineForm, name: event.target.value })}
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
                  />
                </div>
                <PrimaryButton type="submit" disabled={submitting || loading} className="w-full">
                  Save machine to 
                </PrimaryButton>
              </div>
            </form>
          </section>
        ) : null}

        {activeTab === "pricing" ? (
          <section className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <form onSubmit={submitPrice} className="rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-xl font-black">Set peso price per kilo</h3>
              <p className="mt-1 text-sm text-slate-500">This updates pricing.id = 1 .</p>
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
                <PrimaryButton type="submit" disabled={submitting || loading} className="w-full">
                  Update price
                </PrimaryButton>
              </div>
            </form>

            <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-300">Current database rate</p>
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

function AdminOrders({
  orders,
  onAdvanceOrder,
  setMessage,
}: {
  orders: Order[];
  onAdvanceOrder: (order: Order, stage: OrderStage, status: OrderStatus) => Promise<string | null>;
  setMessage: (value: string) => void;
}) {
  const [workingOrder, setWorkingOrder] = useState("");

  async function runAction(order: Order, stage: OrderStage, status: OrderStatus) {
    setWorkingOrder(order.id);
    const result = await onAdvanceOrder(order, stage, status);
    setWorkingOrder("");
    setMessage(result ?? `${order.id} updated to ${stage}.`);
  }

  if (!orders.length) {
    return <EmptyState title="No order rows" text="Orders from washmate will appear here after customers submit laundry." />;
  }

  return (
    <section className="space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-xl font-black">All laundry orders</h3>
          <p className="text-sm text-slate-500">Rows from the orders table. Actions update orders and machine records.</p>
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
                            disabled={workingOrder === order.id}
                            onClick={() => void runAction(order, action.stage, action.status)}
                            className={`rounded-full px-3 py-2 text-xs font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${
                              action.stage === "Cancelled"
                                ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                                : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                            }`}
                          >
                            {workingOrder === order.id ? "Updating..." : action.label}
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
        <h3 className="text-xl font-black">Order action to status mapping</h3>
        <p className="mt-1 text-sm text-slate-500">These are business rules, not database seed records.</p>
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
  );
}

function MachineRow({
  machine,
  loading,
  onStatusChange,
  onNoteSave,
  setMessage,
}: {
  machine: Machine;
  loading: boolean;
  onStatusChange: (machine: Machine, status: MachineStatus) => Promise<string | null>;
  onNoteSave: (machine: Machine, note: string) => Promise<string | null>;
  setMessage: (value: string) => void;
}) {
  const [note, setNote] = useState(machine.note || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => setNote(machine.note || ""), [machine.note]);

  async function updateStatus(status: MachineStatus) {
    setSaving(true);
    const result = await onStatusChange(machine, status);
    setSaving(false);
    setMessage(result ?? `${machine.name} status updated to ${status}.`);
  }

  async function saveNote() {
    setSaving(true);
    const result = await onNoteSave(machine, note);
    setSaving(false);
    setMessage(result ?? `${machine.name} note saved.`);
  }

  return (
    <div className="grid gap-4 px-5 py-5 lg:grid-cols-[1fr_190px_1.1fr] lg:items-center">
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
          disabled={saving || loading}
          onChange={(event) => void updateStatus(event.target.value as MachineStatus)}
        >
          {machineStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </SelectInput>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2">
          <FieldLabel>Maintenance note</FieldLabel>
          <TextInput value={note} disabled={saving || loading} onChange={(event) => setNote(event.target.value)} />
        </div>
        <SecondaryButton type="button" disabled={saving || loading} onClick={() => void saveNote()}>
          Save
        </SecondaryButton>
      </div>
    </div>
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
  apiError,
  lastSync,
  loading,
  onLogout,
  onRefresh,
  onCreateOrder,
}: {
  currentUser: AppUser;
  orders: Order[];
  pricePerKilo: number;
  apiError: string;
  lastSync: string | null;
  loading: boolean;
  onLogout: () => void;
  onRefresh: () => void;
  onCreateOrder: (form: LaundryForm) => Promise<string | null>;
}) {
  const [activeTab, setActiveTab] = useState<"book" | "orders" | "rates">("book");
  const [laundryForm, setLaundryForm] = useState<LaundryForm>({ kilograms: "", paymentMethod: "Cash" });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const customerOrders = orders.filter((order) => order.customerId === currentUser.id);
  const kilograms = Number(laundryForm.kilograms);
  const total = Number.isFinite(kilograms) && kilograms > 0 ? roundMoney(kilograms * pricePerKilo) : 0;

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const result = await onCreateOrder(laundryForm);
    setSubmitting(false);
    setMessage(result ?? "Laundry order saved. Admin can now mark it as washing.");
    if (!result) {
      setLaundryForm({ kilograms: "", paymentMethod: "Cash" });
    }
  }

  return (
    <DashboardShell currentUser={currentUser} onLogout={onLogout} onRefresh={onRefresh} loading={loading}>
      <section className="animate-rise-in space-y-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-600">Customer Portal</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Book and track laundry</h2>

          </div>
          <p className="text-sm font-semibold text-slate-600">Current price: {formatPeso(pricePerKilo)} per kg</p>
        </div>

        <ApiAlert error={apiError} onRefresh={onRefresh} />
        <ConnectionPanel lastSync={lastSync} error={apiError} onRefresh={onRefresh} loading={loading} />

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
              <p className="mt-1 text-sm text-slate-500">The peso total is calculated from the pricing table.</p>
              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <FieldLabel>Kilograms</FieldLabel>
                  <TextInput
                    type="number"
                    min="0.5"
                    step="0.25"
                    value={laundryForm.kilograms}
                    onChange={(event) => setLaundryForm({ ...laundryForm, kilograms: event.target.value })}
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
                <PrimaryButton type="submit" disabled={submitting || loading} className="w-full">
                  {submitting ? "Saving order..." : "Submit order to Washmate"}
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
                      <span className="text-slate-300">Price per kilo from DB</span>
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
              <EmptyState title="No orders for this account" text="Create an order or check that customerId matches your account id." />
            )}
          </section>
        ) : null}

        {activeTab === "rates" ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6">
            <h3 className="text-xl font-black">Customer price list</h3>
            <p className="mt-1 text-sm text-slate-500">This rate comes from pricing.pricePerKilo.</p>
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

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="animate-rise-in text-center">
        <div className="mx-auto mb-5 flex justify-center">
          <LogoMark />
        </div>
        <p className="text-sm font-black uppercase tracking-[0.32em] text-sky-300">Connecting</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Loading Washmate records</h1>
        <p className="mt-3 text-slate-300">Requesting /api/bootstrap from the Express server.</p>
      </div>
    </main>
  );
}

export default function App() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [pricePerKilo, setPricePerKilo] = useState(0);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);

  const machineByName = useMemo(() => new Map(machines.map((machine) => [machine.name, machine])), [machines]);

  async function refreshData() {
    setLoading(true);
    try {
      const data = await apiRequest<BootstrapData>("/api/bootstrap");
      const nextUsers = data.users || [];
      setUsers(nextUsers);
      setOrders((data.orders || []).map((order) => ({ ...order, kilograms: Number(order.kilograms), total: Number(order.total) })));
      setMachines((data.machines || []).map((machine) => ({ ...machine, capacityKg: Number(machine.capacityKg) })));
      setPricePerKilo(Number(data.pricePerKilo || 0));
      setLastSync(new Date().toISOString());
      setApiError("");

      setCurrentUser((existing) => {
        if (!existing) {
          return existing;
        }

        return nextUsers.find((user) => user.id === existing.id) || null;
      });
    } catch (error) {
      setApiError(getErrorMessage(error));
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  }

  useEffect(() => {
    void refreshData();
  }, []);

  async function mutate<T>(action: () => Promise<T>) {
    setLoading(true);
    try {
      const result = await action();
      await refreshData();
      return { result, error: null as string | null };
    } catch (error) {
      const message = getErrorMessage(error);
      setApiError(message);
      return { result: null, error: message };
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(email: string, password: string) {
    const { result, error } = await mutate(() =>
      apiRequest<LoginResponse>("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, username: email, password }),
      }),
    );

    if (error) {
      return error;
    }

    if (!result?.user) {
      return "Login succeeded but the API did not return a user record.";
    }

    setCurrentUser(result.user);
    return null;
  }

  async function handleRegisterCustomer(form: CustomerForm) {
    const payload = {
      role: "customer",
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      username: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      password: form.password,
    };

    const { result, error } = await mutate(() =>
      apiRequest<RegisterResponse>("/api/register", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );

    if (error) {
      return error;
    }

    if (!result?.user) {
      return "Account was created but the API did not return the new user.";
    }

    setCurrentUser(result.user);
    return null;
  }

  function handleLogout() {
    setCurrentUser(null);
  }

  async function handleAddCustomer(form: CustomerForm) {
    const payload = {
      role: "customer",
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      username: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      password: form.password,
    };

    const { error } = await mutate(() =>
      apiRequest<RegisterResponse>("/api/customers", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );

    return error;
  }

  async function handleAddMachine(form: MachineForm) {
    const capacityKg = Number(form.capacityKg);
    if (!form.name.trim() || !Number.isFinite(capacityKg) || capacityKg <= 0) {
      return "Machine name and capacity are required.";
    }

    const { error } = await mutate(() =>
      apiRequest<{ success: boolean; machine: Machine }>("/api/machines", {
        method: "POST",
        body: JSON.stringify({ ...form, name: form.name.trim(), capacityKg }),
      }),
    );

    return error;
  }

  async function handlePriceChange(rate: number) {
    if (!Number.isFinite(rate) || rate <= 0) {
      return "Enter a valid peso price per kilo.";
    }

    const { error } = await mutate(() =>
      apiRequest<{ success: boolean; pricePerKilo: number }>("/api/pricing", {
        method: "PUT",
        body: JSON.stringify({ pricePerKilo: roundMoney(rate) }),
      }),
    );

    return error;
  }

  async function handleMachineStatusChange(machine: Machine, status: MachineStatus) {
    const { error } = await mutate(() =>
      apiRequest<{ success: boolean; machine: Machine }>(`/api/machines/${encodeURIComponent(machine.id)}/status`, {
        method: "PUT",
        body: JSON.stringify({ status, note: status === "Maintenance" ? "Under maintenance" : machine.note }),
      }),
    );

    return error;
  }

  async function handleMachineNoteChange(machine: Machine, note: string) {
    const { error } = await mutate(() =>
      apiRequest<{ success: boolean; machine: Machine }>(`/api/machines/${encodeURIComponent(machine.id)}`, {
        method: "PUT",
        body: JSON.stringify({ note }),
      }),
    );

    return error;
  }

  async function updateMachineStatus(machine: Machine, status: MachineStatus, note: string) {
    await apiRequest<{ success: boolean; machine: Machine }>(`/api/machines/${encodeURIComponent(machine.id)}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, note }),
    });
  }

  async function handleAdvanceOrder(order: Order, stage: OrderStage, status: OrderStatus) {
    const { error } = await mutate(async () => {
      let nextMachine = order.machine;
      const previousMachine = machineByName.get(order.machine);
      const workingMachines = machines.map((machine) => ({ ...machine }));

      if (previousMachine?.status === "In Use") {
        await updateMachineStatus(previousMachine, "Available", `Released from order ${order.id}`);
        const localPrevious = workingMachines.find((machine) => machine.id === previousMachine.id);
        if (localPrevious) {
          localPrevious.status = "Available";
        }
      }

      if (stage === "Washing") {
        const washer = workingMachines.find((machine) => machine.type === "Washer" && machine.status === "Available");
        nextMachine = washer ? washer.name : "Waiting for washer";
        if (washer) {
          await updateMachineStatus(washer, "In Use", `Assigned to order ${order.id}`);
        }
      } else if (stage === "Drying") {
        const dryer = workingMachines.find((machine) => machine.type === "Dryer" && machine.status === "Available");
        nextMachine = dryer ? dryer.name : "Waiting for dryer";
        if (dryer) {
          await updateMachineStatus(dryer, "In Use", `Assigned to order ${order.id}`);
        }
      } else if (stage === "Folding") {
        nextMachine = "Folding area";
      } else if (stage === "Ready for Pickup") {
        nextMachine = "Pickup shelf";
      } else if (stage === "Claimed" || stage === "Cancelled") {
        nextMachine = stage;
      }

      return apiRequest<OrderResponse>(`/api/orders/${encodeURIComponent(order.id)}/status`, {
        method: "PUT",
        body: JSON.stringify({ stage, status, machine: nextMachine, note: `Admin action changed order to ${stage}` }),
      });
    });

    return error;
  }

  async function handleCreateOrder(form: LaundryForm) {
    if (!currentUser) {
      return "Please login again.";
    }

    const kilograms = Number(form.kilograms);
    if (!Number.isFinite(kilograms) || kilograms <= 0) {
      return "Enter a valid laundry weight in kilos.";
    }

    const { error } = await mutate(() =>
      apiRequest<OrderResponse>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerId: currentUser.id,
          customerName: currentUser.name,
          kilograms,
          ratePerKilo: pricePerKilo,
          total: roundMoney(kilograms * pricePerKilo),
          paymentMethod: form.paymentMethod,
          paymentStatus: form.paymentMethod === "Cash" ? "Pay on pickup" : "Paid",
        }),
      }),
    );

    return error;
  }

  if (initializing) {
    return <LoadingScreen />;
  }

  if (!currentUser) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onRegister={handleRegisterCustomer}
        apiError={apiError}
        onRefresh={() => void refreshData()}
        loading={loading}
      />
    );
  }

  if (currentUser.role === "admin") {
    return (
      <AdminDashboard
        currentUser={currentUser}
        users={users}
        orders={orders}
        machines={machines}
        pricePerKilo={pricePerKilo}
        apiError={apiError}
        lastSync={lastSync}
        loading={loading}
        onLogout={handleLogout}
        onRefresh={() => void refreshData()}
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
      apiError={apiError}
      lastSync={lastSync}
      loading={loading}
      onLogout={handleLogout}
      onRefresh={() => void refreshData()}
      onCreateOrder={handleCreateOrder}
    />
  );
}
