"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  GripVertical, 
  Save, 
  Zap, 
  Plus, 
  Trash2, 
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface ProviderConfig {
  id: string;
  providerId: string;
  providerModelId: string;
  priority: number;
  isEnabled: boolean;
  costPerRequest: number;
  provider: {
    id: string;
    name: string;
    displayName: string;
  };
}

interface AppTokenConfig {
  id: string;
  appId: string;
  tokenCost: number;
  app: {
    id: string;
    name: string;
    slug: string;
  };
}

interface Model {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  tokenCost: number;
  isEnabled: boolean;
  providerConfigs: ProviderConfig[];
  appTokenConfigs: AppTokenConfig[];
}

interface Provider {
  id: string;
  name: string;
  displayName: string;
}

interface App {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  model: Model;
  allProviders: Provider[];
  apps: App[];
}

function SortableProviderItem({ 
  config, 
  index,
  onRemove,
  onModelIdChange,
}: { 
  config: ProviderConfig; 
  index: number;
  onRemove: () => void;
  onModelIdChange: (value: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: config.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "16px 20px",
        background: isDragging ? "rgba(39, 39, 42, 0.9)" : "rgba(24, 24, 27, 0.6)",
        border: `1px solid ${isDragging ? "rgba(16, 185, 129, 0.5)" : "rgba(63, 63, 70, 0.4)"}`,
        borderRadius: "12px",
        marginBottom: "12px",
      }}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        style={{
          padding: "8px",
          background: "transparent",
          border: "none",
          cursor: "grab",
          color: "#71717a",
          display: "flex",
          alignItems: "center",
        }}
      >
        <GripVertical style={{ width: "20px", height: "20px" }} />
      </button>

      {/* Priority Badge */}
      <div style={{
        width: "32px",
        height: "32px",
        borderRadius: "8px",
        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
        fontWeight: "700",
        color: "#09090b",
        flexShrink: 0,
      }}>
        {index + 1}
      </div>

      {/* Provider Name */}
      <div style={{ width: "140px", flexShrink: 0 }}>
        <div style={{ fontWeight: "600", color: "#fafafa", fontSize: "14px" }}>
          {config.provider.displayName}
        </div>
        <div style={{ fontSize: "12px", color: "#71717a", fontFamily: "monospace" }}>
          {config.provider.name}
        </div>
      </div>

      {/* Provider Model ID */}
      <div style={{ flex: 1 }}>
        <input
          type="text"
          value={config.providerModelId}
          onChange={(e) => onModelIdChange(e.target.value)}
          placeholder="Provider model ID"
          style={{
            width: "100%",
            padding: "10px 14px",
            background: "rgba(9, 9, 11, 0.6)",
            border: "1px solid rgba(63, 63, 70, 0.5)",
            borderRadius: "8px",
            color: "#fafafa",
            fontSize: "13px",
            fontFamily: "monospace",
          }}
        />
      </div>

      {/* Cost per Request */}
      <div style={{
        padding: "8px 14px",
        background: "rgba(250, 204, 21, 0.1)",
        border: "1px solid rgba(250, 204, 21, 0.2)",
        borderRadius: "8px",
        color: "#fbbf24",
        fontSize: "13px",
        fontWeight: "500",
        display: "flex",
        alignItems: "center",
        gap: "4px",
      }}>
        <span style={{ color: "#a1a1aa", fontSize: "12px" }}>Cost:</span>
        ${config.costPerRequest.toFixed(4)}
      </div>

      {/* Remove Button */}
      <button
        onClick={onRemove}
        style={{
          padding: "8px",
          background: "transparent",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: "8px",
          color: "#ef4444",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Trash2 style={{ width: "16px", height: "16px" }} />
      </button>
    </div>
  );
}

export function ModelEditForm({ model, allProviders, apps }: Props) {
  const [displayName, setDisplayName] = useState(model.displayName);
  const [description, setDescription] = useState(model.description || "");
  const [tokenCost, setTokenCost] = useState(model.tokenCost);
  const [isEnabled, setIsEnabled] = useState(model.isEnabled);
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>(
    model.providerConfigs.map((c, i) => ({ ...c, priority: i + 1 }))
  );
  const [appTokenOverrides, setAppTokenOverrides] = useState<Record<string, number>>(
    Object.fromEntries(model.appTokenConfigs.map((c) => [c.appId, c.tokenCost]))
  );
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setProviderConfigs((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removeProvider = (configId: string) => {
    setProviderConfigs((items) => items.filter((item) => item.id !== configId));
  };

  const updateProviderModelId = (configId: string, value: string) => {
    setProviderConfigs((items) =>
      items.map((item) =>
        item.id === configId ? { ...item, providerModelId: value } : item
      )
    );
  };

  const addProvider = (provider: Provider) => {
    const newConfig: ProviderConfig = {
      id: `new-${Date.now()}`,
      providerId: provider.id,
      providerModelId: "",
      priority: providerConfigs.length + 1,
      isEnabled: true,
      costPerRequest: 0,
      provider,
    };
    setProviderConfigs([...providerConfigs, newConfig]);
  };

  // Providers not yet added
  const availableProviders = allProviders.filter(
    (p) => !providerConfigs.some((c) => c.providerId === p.id)
  );

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/models/${model.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          description,
          tokenCost,
          isEnabled,
          providerConfigs: providerConfigs.map((c, i) => ({
            id: c.id.startsWith("new-") ? undefined : c.id,
            providerId: c.providerId,
            providerModelId: c.providerModelId,
            priority: i + 1,
            isEnabled: c.isEnabled,
          })),
          appTokenOverrides,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      setMessage({ type: "success", text: "Model saved successfully!" });
    } catch (error) {
      setMessage({ 
        type: "error", 
        text: error instanceof Error ? error.message : "Failed to save" 
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Message */}
      {message && (
        <div style={{
          padding: "16px 20px",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: message.type === "success" 
            ? "rgba(16, 185, 129, 0.15)" 
            : "rgba(239, 68, 68, 0.15)",
          border: `1px solid ${message.type === "success" 
            ? "rgba(16, 185, 129, 0.3)" 
            : "rgba(239, 68, 68, 0.3)"}`,
        }}>
          {message.type === "success" ? (
            <Check style={{ width: "20px", height: "20px", color: "#34d399" }} />
          ) : (
            <AlertCircle style={{ width: "20px", height: "20px", color: "#ef4444" }} />
          )}
          <span style={{ 
            color: message.type === "success" ? "#34d399" : "#ef4444",
            fontSize: "14px",
            fontWeight: "500",
          }}>
            {message.text}
          </span>
        </div>
      )}

      {/* Basic Info */}
      <div className="glass" style={{ padding: "28px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#fafafa", marginBottom: "24px" }}>
          Basic Information
        </h2>

        <div style={{ display: "grid", gap: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#a1a1aa", marginBottom: "8px" }}>
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  background: "rgba(9, 9, 11, 0.6)",
                  border: "1px solid rgba(63, 63, 70, 0.5)",
                  borderRadius: "10px",
                  color: "#fafafa",
                  fontSize: "15px",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#a1a1aa", marginBottom: "8px" }}>
                Default Token Cost
              </label>
              <div style={{ position: "relative" }}>
                <Zap style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "18px",
                  height: "18px",
                  color: "#facc15",
                }} />
                <input
                  type="number"
                  value={tokenCost}
                  onChange={(e) => setTokenCost(parseInt(e.target.value) || 0)}
                  min={0}
                  style={{
                    width: "100%",
                    padding: "14px 16px 14px 44px",
                    background: "rgba(9, 9, 11, 0.6)",
                    border: "1px solid rgba(63, 63, 70, 0.5)",
                    borderRadius: "10px",
                    color: "#fafafa",
                    fontSize: "15px",
                  }}
                />
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#a1a1aa", marginBottom: "8px" }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "rgba(9, 9, 11, 0.6)",
                border: "1px solid rgba(63, 63, 70, 0.5)",
                borderRadius: "10px",
                color: "#fafafa",
                fontSize: "15px",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => setIsEnabled(!isEnabled)}
              style={{
                width: "52px",
                height: "28px",
                borderRadius: "14px",
                border: "none",
                cursor: "pointer",
                background: isEnabled 
                  ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                  : "rgba(63, 63, 70, 0.5)",
                position: "relative",
                transition: "background 0.2s ease",
              }}
            >
              <div style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: "#fff",
                position: "absolute",
                top: "3px",
                left: isEnabled ? "27px" : "3px",
                transition: "left 0.2s ease",
              }} />
            </button>
            <span style={{ fontSize: "14px", color: "#a1a1aa" }}>
              Model is {isEnabled ? "enabled" : "disabled"}
            </span>
          </div>
        </div>
      </div>

      {/* Provider Configurations */}
      <div className="glass" style={{ padding: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#fafafa", marginBottom: "4px" }}>
              Provider Priority
            </h2>
            <p style={{ fontSize: "14px", color: "#71717a" }}>
              Drag to reorder. Lower priority numbers are tried first.
            </p>
          </div>
          
          {availableProviders.length > 0 && (
            <div style={{ position: "relative" }}>
              <select
                onChange={(e) => {
                  const provider = availableProviders.find((p) => p.id === e.target.value);
                  if (provider) {
                    addProvider(provider);
                    e.target.value = "";
                  }
                }}
                defaultValue=""
                style={{
                  padding: "10px 40px 10px 16px",
                  background: "rgba(24, 24, 27, 0.8)",
                  border: "1px solid rgba(63, 63, 70, 0.5)",
                  borderRadius: "10px",
                  color: "#fafafa",
                  fontSize: "14px",
                  cursor: "pointer",
                  appearance: "none",
                }}
              >
                <option value="" disabled>Add Provider...</option>
                {availableProviders.map((p) => (
                  <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
              </select>
              <Plus style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "16px",
                height: "16px",
                color: "#71717a",
                pointerEvents: "none",
              }} />
            </div>
          )}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={providerConfigs.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {providerConfigs.map((config, index) => (
              <SortableProviderItem
                key={config.id}
                config={config}
                index={index}
                onRemove={() => removeProvider(config.id)}
                onModelIdChange={(value) => updateProviderModelId(config.id, value)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {providerConfigs.length === 0 && (
          <div style={{
            padding: "40px",
            textAlign: "center",
            color: "#71717a",
            fontSize: "14px",
          }}>
            No providers configured. Add a provider to enable this model.
          </div>
        )}
      </div>

      {/* Per-App Token Overrides */}
      <div className="glass" style={{ padding: "28px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#fafafa", marginBottom: "4px" }}>
            Per-App Token Cost Overrides
          </h2>
          <p style={{ fontSize: "14px", color: "#71717a" }}>
            Set custom token costs for specific apps. Leave empty to use the default ({tokenCost} tokens).
          </p>
        </div>

        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
          gap: "16px" 
        }}>
          {apps.map((app) => (
            <div
              key={app.id}
              style={{
                padding: "16px 20px",
                background: "rgba(24, 24, 27, 0.6)",
                border: "1px solid rgba(63, 63, 70, 0.4)",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div>
                <div style={{ fontWeight: "500", color: "#fafafa", fontSize: "14px" }}>
                  {app.name}
                </div>
                <div style={{ fontSize: "12px", color: "#71717a", fontFamily: "monospace" }}>
                  {app.slug}
                </div>
              </div>
              <div style={{ position: "relative", width: "100px" }}>
                <Zap style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "14px",
                  height: "14px",
                  color: appTokenOverrides[app.id] ? "#facc15" : "#52525b",
                }} />
                <input
                  type="number"
                  value={appTokenOverrides[app.id] || ""}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (isNaN(value) || value <= 0) {
                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                      const { [app.id]: _, ...rest } = appTokenOverrides;
                      setAppTokenOverrides(rest);
                    } else {
                      setAppTokenOverrides({ ...appTokenOverrides, [app.id]: value });
                    }
                  }}
                  placeholder={String(tokenCost)}
                  min={0}
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 32px",
                    background: "rgba(9, 9, 11, 0.6)",
                    border: `1px solid ${appTokenOverrides[app.id] ? "rgba(250, 204, 21, 0.4)" : "rgba(63, 63, 70, 0.5)"}`,
                    borderRadius: "8px",
                    color: "#fafafa",
                    fontSize: "14px",
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {apps.length === 0 && (
          <div style={{
            padding: "40px",
            textAlign: "center",
            color: "#71717a",
            fontSize: "14px",
          }}>
            No apps configured yet.
          </div>
        )}
      </div>

      {/* Save Button */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "16px" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 28px",
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            color: "#09090b",
            borderRadius: "12px",
            fontSize: "15px",
            fontWeight: "600",
            border: "none",
            cursor: saving ? "wait" : "pointer",
            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? (
            <Loader2 style={{ width: "18px", height: "18px", animation: "spin 1s linear infinite" }} />
          ) : (
            <Save style={{ width: "18px", height: "18px" }} />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

