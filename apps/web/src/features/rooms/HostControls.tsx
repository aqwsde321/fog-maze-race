import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import type { RoomBotKind } from "@fog-maze-race/shared/contracts/realtime";
import type { RoomMode } from "@fog-maze-race/shared/domain/status";

type HostControlsProps = {
  roomId: string;
  roomName: string;
  roomMode: RoomMode;
  visibilitySize: 3 | 5 | 7;
  canEditVisibility: boolean;
  canManageBots: boolean;
  availableBotSlots: number;
  memberNicknames: string[];
  currentBots: Array<{ playerId: string; nickname: string }>;
  onRenameRoom: (name: string) => void;
  onSetVisibilitySize: (visibilitySize: 3 | 5 | 7) => void;
  onAddBots: (input: { kind: RoomBotKind; nicknames: string[] }) => void;
  onRemoveBots: (playerIds?: string[]) => void;
};

const DEFAULT_BOT_COUNT = 2;

export function HostControls({
  roomId,
  roomName,
  roomMode,
  visibilitySize,
  canEditVisibility,
  canManageBots,
  availableBotSlots,
  memberNicknames,
  currentBots,
  onRenameRoom,
  onSetVisibilitySize,
  onAddBots,
  onRemoveBots
}: HostControlsProps) {
  const [draftName, setDraftName] = useState(roomName);
  const [botKind, setBotKind] = useState<RoomBotKind>("explore");
  const [botCount, setBotCount] = useState<number>(() => resolveBotCount(DEFAULT_BOT_COUNT, availableBotSlots));
  const [isBotPanelOpen, setIsBotPanelOpen] = useState(false);
  const [botNameDrafts, setBotNameDrafts] = useState<string[]>(() =>
    createBotNameDrafts({
      previous: [],
      count: resolveBotCount(DEFAULT_BOT_COUNT, availableBotSlots),
      usedNicknames: memberNicknames
    })
  );
  const memberNicknamesKey = useMemo(() => memberNicknames.join("|"), [memberNicknames]);
  const botCountOptions = useMemo(
    () => Array.from({ length: Math.max(availableBotSlots, 0) }, (_, index) => index + 1),
    [availableBotSlots]
  );
  const canOpenBotPanel = canManageBots && availableBotSlots > 0;

  useEffect(() => {
    setDraftName(roomName);
  }, [roomName]);

  useEffect(() => {
    const nextCount = resolveBotCount(botCount, availableBotSlots);
    if (nextCount !== botCount) {
      setBotCount(nextCount);
    }

    if (availableBotSlots === 0) {
      setIsBotPanelOpen(false);
    }
  }, [availableBotSlots, botCount]);

  useEffect(() => {
    if (!isBotPanelOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setIsBotPanelOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBotPanelOpen]);

  useEffect(() => {
    setBotNameDrafts((previous) =>
      createBotNameDrafts({
        previous,
        count: resolveBotCount(botCount, availableBotSlots),
        usedNicknames: memberNicknames
      })
    );
  }, [availableBotSlots, botCount, memberNicknamesKey, roomId]);

  void draftName;
  void onRenameRoom;

  const canSubmitBots = canOpenBotPanel && botNameDrafts.some((nickname) => Boolean(normalizeNickname(nickname)));
  const botActionLabel = roomMode === "bot_race" ? "봇 채우기" : "봇 참가시키기";
  const botHelperText =
    roomMode === "bot_race"
      ? "이 방에서는 봇만 참가하고, 당신은 관전과 시작/재시작만 맡습니다."
      : "이 방에서는 사람과 봇이 함께 달립니다. 시작과 재시작은 계속 방장이 합니다.";
  const canRemoveBots = canManageBots && currentBots.length > 0;

  function handleBotNameChange(index: number, value: string) {
    setBotNameDrafts((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  }

  function handleAddBotsClick() {
    const nicknames = botNameDrafts
      .map((nickname) => normalizeNickname(nickname))
      .filter((nickname): nickname is string => Boolean(nickname));
    if (nicknames.length === 0) {
      return;
    }

    onAddBots({
      kind: botKind,
      nicknames
    });
    setBotNameDrafts(
      createBotNameDrafts({
        previous: [],
        count: botCount,
        usedNicknames: [...memberNicknames, ...nicknames]
      })
    );
    setIsBotPanelOpen(false);
  }

  function handleRemoveBotClick(playerId: string) {
    onRemoveBots([playerId]);
  }

  function handleRemoveAllBotsClick() {
    onRemoveBots(currentBots.map((bot) => bot.playerId));
  }

  return (
    <div style={panelStyle}>
      <div style={rowStyle}>
        <label htmlFor="visibility-size" style={hiddenLabelStyle}>
          시야 크기
        </label>
        <select
          id="visibility-size"
          name="visibility-size"
          value={visibilitySize}
          disabled={!canEditVisibility}
          onChange={(event) => onSetVisibilitySize(Number(event.target.value) as 3 | 5 | 7)}
          style={selectStyle}
        >
          <option value={7}>7x7</option>
          <option value={5}>5x5</option>
          <option value={3}>3x3</option>
        </select>
      </div>

      <div style={botToggleWrapStyle}>
        <button
          data-testid="toggle-bot-panel-button"
          type="button"
          onClick={() => setIsBotPanelOpen((previous) => !previous)}
          disabled={!canOpenBotPanel}
          style={toggleButtonStyle}
        >
          {isBotPanelOpen ? "봇 설정 닫기" : "봇 설정"}
        </button>
      </div>

      {isBotPanelOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              data-testid="bot-panel-overlay"
              style={botOverlayStyle}
              onClick={() => setIsBotPanelOpen(false)}
            >
              <div
                style={botPanelStyle}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={botHeaderRowStyle}>
                  <div style={botHeaderStyle}>
                    <div>
                      <p style={botLabelStyle}>Bot Control</p>
                      <strong style={botTitleStyle}>{botActionLabel}</strong>
                    </div>
                    <span style={botHintStyle}>{botHelperText}</span>
                  </div>
                  <button
                    data-testid="bot-panel-close-button"
                    type="button"
                    onClick={() => setIsBotPanelOpen(false)}
                    style={botCloseButtonStyle}
                  >
                    닫기
                  </button>
                </div>

                <div style={botConfigRowStyle}>
                  <label htmlFor="bot-kind" style={hiddenLabelStyle}>
                    봇 종류
                  </label>
                  <select
                    id="bot-kind"
                    name="bot-kind"
                    value={botKind}
                    disabled={!canManageBots}
                    onChange={(event) => setBotKind(event.target.value as RoomBotKind)}
                    style={selectStyle}
                  >
                    <option value="explore">탐험형</option>
                    <option value="join">최단 경로형</option>
                  </select>

                  <label htmlFor="bot-count" style={hiddenLabelStyle}>
                    봇 수
                  </label>
                  <select
                    id="bot-count"
                    name="bot-count"
                    value={botCount}
                    disabled={!canManageBots}
                    onChange={(event) => setBotCount(Number(event.target.value))}
                    style={selectStyle}
                  >
                    {botCountOptions.map((count) => (
                      <option key={count} value={count}>
                        {count}명
                      </option>
                    ))}
                  </select>
                </div>

                <div style={botInputsStyle}>
                  {botNameDrafts.map((draft, index) => (
                    <input
                      key={`${roomId}-${index}`}
                      data-testid={`bot-name-input-${index}`}
                      type="text"
                      maxLength={5}
                      value={draft}
                      disabled={!canManageBots}
                      onChange={(event) => handleBotNameChange(index, event.target.value)}
                      style={inputStyle}
                    />
                  ))}
                </div>

                <button
                  data-testid="add-bots-button"
                  type="button"
                  onClick={handleAddBotsClick}
                  disabled={!canSubmitBots}
                  style={addBotsButtonStyle}
                >
                  {botActionLabel}
                </button>

                <div style={botManageSectionStyle}>
                  <div style={botManageHeaderStyle}>
                    <strong style={botManageTitleStyle}>현재 봇</strong>
                    <button
                      data-testid="remove-all-bots-button"
                      type="button"
                      onClick={handleRemoveAllBotsClick}
                      disabled={!canRemoveBots}
                      style={removeAllBotsButtonStyle}
                    >
                      모두 제거
                    </button>
                  </div>
                  {currentBots.length > 0 ? (
                    <div style={botListStyle}>
                      {currentBots.map((bot) => (
                        <div key={bot.playerId} style={botListItemStyle}>
                          <span style={botListNameStyle}>{bot.nickname}</span>
                          <button
                            data-testid={`remove-bot-button-${bot.playerId}`}
                            type="button"
                            onClick={() => handleRemoveBotClick(bot.playerId)}
                            disabled={!canManageBots}
                            style={removeBotButtonStyle}
                          >
                            제거
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={botEmptyTextStyle}>아직 들어온 봇이 없습니다.</p>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function createBotNameDrafts(input: {
  previous: string[];
  count: number;
  usedNicknames: string[];
}) {
  const count = Math.max(1, input.count);
  const used = new Set(
    input.usedNicknames
      .map((nickname) => normalizeNickname(nickname))
      .filter((nickname): nickname is string => Boolean(nickname))
  );
  const drafts: string[] = [];
  let fallbackIndex = 1;

  for (let index = 0; index < count; index += 1) {
    const candidate = normalizeNickname(input.previous[index]);
    if (candidate && !used.has(candidate) && !drafts.includes(candidate)) {
      drafts.push(candidate);
      continue;
    }

    const fallback = createNextDefaultNickname(used, drafts, fallbackIndex);
    drafts.push(fallback);
    used.add(fallback);
    fallbackIndex = extractBotSuffix(fallback) + 1;
  }

  return drafts;
}

function createNextDefaultNickname(used: Set<string>, drafts: string[], initialIndex: number) {
  let index = Math.max(initialIndex, 1);
  while (index < 100) {
    const candidate = `bot${index}`.slice(0, 5);
    if (!used.has(candidate) && !drafts.includes(candidate)) {
      return candidate;
    }
    index += 1;
  }

  return "bot1";
}

function extractBotSuffix(nickname: string) {
  const suffix = nickname.match(/(\d+)$/)?.[1];
  return suffix ? Number.parseInt(suffix, 10) : 1;
}

function resolveBotCount(requestedCount: number, availableBotSlots: number) {
  if (availableBotSlots <= 0) {
    return 0;
  }

  return Math.min(Math.max(requestedCount, 1), availableBotSlots);
}

function normalizeNickname(value: string | null | undefined) {
  const normalized = value?.trim().slice(0, 5);
  return normalized ? normalized : null;
}

const panelStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  display: "grid",
  gap: "10px"
};

const hiddenLabelStyle: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "4px"
};

const botToggleWrapStyle: CSSProperties = {
  display: "grid"
};

const botPanelStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  width: "min(356px, calc(100vw - 24px))",
  padding: "14px",
  borderRadius: "18px",
  border: "1px solid rgba(125, 211, 252, 0.14)",
  background: "linear-gradient(180deg, rgba(10, 18, 33, 0.96), rgba(8, 15, 30, 0.94))",
  boxShadow: "0 22px 56px rgba(2, 6, 23, 0.42)",
  boxSizing: "border-box",
  backdropFilter: "blur(10px)"
};

const botOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 30,
  display: "grid",
  justifyItems: "end",
  alignItems: "start",
  padding: "clamp(72px, 12vh, 108px) 12px 12px",
  background: "rgba(2, 6, 23, 0.2)"
};

const botHeaderRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "12px",
  alignItems: "start"
};

const botHeaderStyle: CSSProperties = {
  display: "grid",
  gap: "6px"
};

const botLabelStyle: CSSProperties = {
  margin: 0,
  color: "#7dd3fc",
  fontSize: "0.7rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase"
};

const botTitleStyle: CSSProperties = {
  color: "#f8fafc",
  fontSize: "0.92rem"
};

const botHintStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: "0.78rem",
  lineHeight: 1.45
};

const botCloseButtonStyle: CSSProperties = {
  minHeight: "32px",
  padding: "6px 10px",
  borderRadius: "11px",
  border: "1px solid rgba(148, 163, 184, 0.22)",
  background: "rgba(15, 23, 42, 0.78)",
  color: "#cbd5e1",
  cursor: "pointer",
  fontSize: "0.78rem",
  whiteSpace: "nowrap"
};

const botConfigRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px"
};

const botInputsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
  gap: "8px"
};

const botManageSectionStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  paddingTop: "4px",
  borderTop: "1px solid rgba(148, 163, 184, 0.12)"
};

const botManageHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px"
};

const botManageTitleStyle: CSSProperties = {
  color: "#e2e8f0",
  fontSize: "0.82rem"
};

const botListStyle: CSSProperties = {
  display: "grid",
  gap: "8px"
};

const botListItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "10px",
  alignItems: "center",
  padding: "8px 10px",
  borderRadius: "12px",
  background: "rgba(15, 23, 42, 0.56)",
  border: "1px solid rgba(148, 163, 184, 0.12)"
};

const botListNameStyle: CSSProperties = {
  color: "#f8fafc",
  fontSize: "0.82rem"
};

const botEmptyTextStyle: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "0.76rem"
};

const selectStyle: CSSProperties = {
  minHeight: "32px",
  padding: "6px 8px",
  borderRadius: "10px",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: "rgba(15, 23, 42, 0.7)",
  color: "#f8fafc",
  fontSize: "0.78rem"
};

const inputStyle: CSSProperties = {
  minHeight: "36px",
  padding: "8px 10px",
  borderRadius: "12px",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: "rgba(15, 23, 42, 0.7)",
  color: "#f8fafc",
  fontSize: "0.85rem"
};

const addBotsButtonStyle: CSSProperties = {
  minHeight: "36px",
  padding: "8px 11px",
  borderRadius: "12px",
  border: "1px solid rgba(56, 189, 248, 0.24)",
  background: "rgba(56, 189, 248, 0.12)",
  color: "#bae6fd",
  cursor: "pointer",
  fontSize: "0.82rem",
  whiteSpace: "nowrap"
};

const removeAllBotsButtonStyle: CSSProperties = {
  minHeight: "30px",
  padding: "5px 10px",
  borderRadius: "10px",
  border: "1px solid rgba(248, 113, 113, 0.2)",
  background: "rgba(239, 68, 68, 0.12)",
  color: "#fecaca",
  cursor: "pointer",
  fontSize: "0.75rem",
  whiteSpace: "nowrap"
};

const removeBotButtonStyle: CSSProperties = {
  minHeight: "30px",
  padding: "5px 10px",
  borderRadius: "10px",
  border: "1px solid rgba(248, 113, 113, 0.2)",
  background: "rgba(239, 68, 68, 0.1)",
  color: "#fecaca",
  cursor: "pointer",
  fontSize: "0.74rem",
  whiteSpace: "nowrap"
};

const toggleButtonStyle: CSSProperties = {
  minHeight: "34px",
  padding: "7px 11px",
  borderRadius: "12px",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: "rgba(15, 23, 42, 0.7)",
  color: "#cbd5e1",
  cursor: "pointer",
  fontSize: "0.8rem",
  whiteSpace: "nowrap"
};
