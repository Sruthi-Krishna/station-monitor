import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <main className="page">
      <header>
        <h1>Station Monitor</h1>
        <p className="sub">
          Demo dashboard with simulated instruments. Data is synthetic and refreshes every few
          seconds through a GraphQL API.
        </p>
      </header>
      <Dashboard />
    </main>
  );
}
