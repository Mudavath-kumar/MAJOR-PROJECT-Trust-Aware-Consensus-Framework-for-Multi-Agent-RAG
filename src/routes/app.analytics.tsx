import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CONFIDENCE_DIST,
  HALLUCINATION,
  LATENCY,
  QUERIES_PER_DAY,
  TRUST_DIST,
} from "@/lib/trustrag-data";
import { MonoLabel, PageHeader, Panel } from "@/components/app/Primitives";

export const Route = createFileRoute("/app/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — TrustRAG Console" },
      {
        name: "description",
        content: "Confidence and trust distribution, query volume, latency and hallucination rate over time.",
      },
      { property: "og:title", content: "TrustRAG Analytics" },
      { property: "og:description", content: "Measure reliability, not just usage." },
    ],
  }),
  component: Analytics,
});

const AXIS = { stroke: "currentColor", fontSize: 11, tickLine: false, axisLine: false } as const;
const TOOLTIP = {
  contentStyle: {
    background: "rgba(15,15,15,0.92)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 12,
    fontSize: 12,
    color: "#fff",
  },
} as const;
const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)"];

function ChartCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Panel className="animate-rise p-5">
      <MonoLabel>{title}</MonoLabel>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <div className="mt-4 h-56 text-muted-foreground">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function Analytics() {
  return (
    <>
      <PageHeader
        eyebrow="Reliability"
        title="Measure the trust, not just the traffic."
        description="How confident the system is, how much the agents agree, and how often it drifts."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Confidence distribution" hint="Answers grouped by confidence band">
          <BarChart data={CONFIDENCE_DIST}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="bucket" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip {...TOOLTIP} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="value" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Trust distribution" hint="Source trust level across answered queries">
          <PieChart>
            <Tooltip {...TOOLTIP} />
            <Pie
              data={TRUST_DIST}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              label={({ name, value }) => `${name} ${value}`}
              labelLine={false}
            >
              {TRUST_DIST.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i]} stroke="transparent" />
              ))}
            </Pie>
          </PieChart>
        </ChartCard>

        <ChartCard title="Queries per day" hint="Last 7 days">
          <AreaChart data={QUERIES_PER_DAY}>
            <defs>
              <linearGradient id="q" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="day" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip {...TOOLTIP} />
            <Area type="monotone" dataKey="queries" stroke="var(--chart-1)" fill="url(#q)" strokeWidth={2} />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Documents uploaded" hint="Ingestion volume per day">
          <BarChart data={QUERIES_PER_DAY}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="day" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip {...TOOLTIP} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="docs" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Latency" hint="Seconds to final response (p50 / p95)">
          <LineChart data={LATENCY}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="day" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip {...TOOLTIP} />
            <Line type="monotone" dataKey="p50" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="p95" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Hallucination rate" hint="% of claims without a matching source, by week">
          <AreaChart data={HALLUCINATION}>
            <defs>
              <linearGradient id="h" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="week" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip {...TOOLTIP} />
            <Area type="monotone" dataKey="rate" stroke="var(--chart-4)" fill="url(#h)" strokeWidth={2} />
          </AreaChart>
        </ChartCard>
      </div>
    </>
  );
}