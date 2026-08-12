"use client";

import EventLog from "@/components/EventLog";
import PipelineGraph from "@/components/PipelineGraph";
import ResultTabs from "@/components/Resulttabs";
import Sidebar from "@/components/Sidebar";
import { Mode } from "@/lib/types";
import { useResearchStream } from "@/lib/useResearchStream";
import { useState } from "react";

export default function ResearchPage() {
  const [mode, setMode] = useState<Mode>("decision");
  const [query, setQuery] = useState("Should I learn LangGraph or CrewAI for AI engineering?");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [goal, setGoal] = useState("");
  const [constraints, setConstraints] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [experience, setExperience] = useState("");
  const [location, setLocation] = useState("");
  const [currentSkills, setCurrentSkills] = useState("");
  const [repoUrl, setRepoUrl] = useState("");

  const stream = useResearchStream();

  const handleRun = () => {
    stream.run({
      mode,
      query,
      option_a: optionA,
      option_b: optionB,
      goal,
      constraints: constraints.split("\n").map((s) => s.trim()).filter(Boolean),
      target_role: targetRole,
      experience,
      location,
      current_skills: currentSkills.split("\n").map((s) => s.trim()).filter(Boolean),
      repo_url: repoUrl,
    });
  };

  const hasRun = stream.pipeline.length > 0;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar
        mode={mode}
        setMode={setMode}
        query={query}
        setQuery={setQuery}
        optionA={optionA}
        setOptionA={setOptionA}
        optionB={optionB}
        setOptionB={setOptionB}
        goal={goal}
        setGoal={setGoal}
        constraints={constraints}
        setConstraints={setConstraints}
        targetRole={targetRole}
        setTargetRole={setTargetRole}
        experience={experience}
        setExperience={setExperience}
        location={location}
        setLocation={setLocation}
        currentSkills={currentSkills}
        setCurrentSkills={setCurrentSkills}
        repoUrl={repoUrl}
        setRepoUrl={setRepoUrl}
        onRun={handleRun}
        running={stream.running}
      />

      <main style={{ flex: 1, padding: "28px 36px", maxWidth: 1200 }}>
        <div style={{ marginBottom: 22 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--signal-verified)", letterSpacing: "0.08em" }}>
            LIVE PIPELINE
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "4px 0 0" }}>
            {hasRun ? query || "Agent run" : "Configure a run and press Run Agent"}
          </h1>
        </div>

        <section
          style={{
            border: "1px solid var(--graphite)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            background: "var(--panel)66",
          }}
        >
          <PipelineGraph pipeline={stream.pipeline} nodeStatus={stream.nodeStatus} />
        </section>

        <EventLog log={stream.log} running={stream.running} />

        {stream.error && (
          <p style={{ color: "var(--signal-contradiction)", marginTop: 12, fontSize: 13 }}>{stream.error}</p>
        )}

        {hasRun && (
          <ResultTabs
            final={stream.final}
            decision={stream.decision}
            comparison={stream.comparison}
            career={stream.career}
            codebase={stream.codebase}
            sources={stream.sources}
            claims={stream.claims}
          />
        )}
      </main>
    </div>
  );
}