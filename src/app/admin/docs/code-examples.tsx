"use client";

import { useState } from "react";
import { Terminal, Code2, ChevronDown, ChevronRight } from "lucide-react";

interface TabContent {
  language: string;
  label: string;
  code: string;
}

export function TabbedCodeBlock({
  title,
  tabs,
  defaultOpen = false,
}: {
  title: string;
  tabs: TabContent[];
  defaultOpen?: boolean;
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const activeContent = tabs[activeTab];

  return (
    <div style={{
      background: "rgba(9, 9, 11, 0.8)",
      borderRadius: "12px",
      border: "1px solid rgba(63, 63, 70, 0.5)",
      overflow: "hidden",
      marginBottom: "16px",
    }}>
      {/* Header with collapse toggle and tabs */}
      <div style={{
        background: "rgba(39, 39, 42, 0.3)",
        borderBottom: isOpen ? "1px solid rgba(63, 63, 70, 0.5)" : "none",
      }}>
        {/* Title row */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: "100%",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "none",
            border: "none",
            cursor: "pointer",
            borderBottom: isOpen ? "1px solid rgba(63, 63, 70, 0.3)" : "none",
          }}
        >
          {isOpen ? (
            <ChevronDown style={{ width: "16px", height: "16px", color: "#9ca3af" }} />
          ) : (
            <ChevronRight style={{ width: "16px", height: "16px", color: "#9ca3af" }} />
          )}
          <span style={{ fontSize: "14px", color: "#e4e4e7", fontWeight: "500" }}>
            {title}
          </span>
        </button>

        {/* Tabs */}
        {isOpen && (
          <div style={{
            display: "flex",
            gap: "0",
            padding: "0 12px",
          }}>
            {tabs.map((tab, index) => (
              <button
                key={tab.language}
                onClick={() => setActiveTab(index)}
                style={{
                  padding: "10px 16px",
                  background: activeTab === index 
                    ? "rgba(99, 102, 241, 0.15)" 
                    : "transparent",
                  border: "none",
                  borderBottom: activeTab === index 
                    ? "2px solid #818cf8" 
                    : "2px solid transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                {tab.language === "bash" || tab.language === "curl" ? (
                  <Terminal style={{ 
                    width: "14px", 
                    height: "14px", 
                    color: activeTab === index ? "#818cf8" : "#9ca3af" 
                  }} />
                ) : (
                  <Code2 style={{ 
                    width: "14px", 
                    height: "14px", 
                    color: activeTab === index ? "#818cf8" : "#9ca3af" 
                  }} />
                )}
                <span style={{ 
                  fontSize: "13px", 
                  fontWeight: "500",
                  color: activeTab === index ? "#e4e4e7" : "#9ca3af",
                }}>
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Code content */}
      {isOpen && (
        <pre style={{
          margin: 0,
          padding: "16px 20px",
          overflow: "auto",
          fontSize: "13px",
          lineHeight: "1.6",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
          maxHeight: "400px",
        }}>
          <code style={{ color: "#e4e4e7" }}>{activeContent.code}</code>
        </pre>
      )}
    </div>
  );
}

export function EndpointExamples({
  endpoint,
  method,
  examples,
}: {
  endpoint: string;
  method: "GET" | "POST";
  examples: {
    curl: string;
    swift: string;
  };
}) {
  return (
    <TabbedCodeBlock
      title={`${method} ${endpoint}`}
      defaultOpen={false}
      tabs={[
        { language: "curl", label: "cURL", code: examples.curl },
        { language: "swift", label: "Swift", code: examples.swift },
      ]}
    />
  );
}




