import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import type {
  RoomBotKind,
  RoomBotRequest,
  RoomBotSpeedMultiplier,
  RoomExploreStrategy
} from "@fog-maze-race/shared/contracts/realtime";
import type { RoomMode } from "@fog-maze-race/shared/domain/status";

import { SelectField, baseSelectStyle } from "./SelectField.js";

type HostControlsProps = {
  roomId: string;
  roomName: string;
  roomMode: RoomMode;
  visibilitySize: 3 | 5 | 7;
  botSpeedMultiplier: RoomBotSpeedMultiplier;
  canEditVisibility: boolean;
  canManageBots: boolean;
  availableBotSlots: number;
  defaultBotNicknameBase?: string | null;
  memberNicknames: string[];
  currentBots: Array<{ playerId: string; nickname: string; strategy?: RoomExploreStrategy | null }>;
  onRenameRoom: (name: string) => void;
  onSetVisibilitySize: (visibilitySize: 3 | 5 | 7) => void;
  onSetBotSpeedMultiplier: (botSpeedMultiplier: RoomBotSpeedMultiplier) => void;
  onAddBots: (input: { kind: RoomBotKind; bots: RoomBotRequest[] }) => void;
  onRemoveBots: (playerIds?: string[]) => void;
};

const DEFAULT_BOT_COUNT = 1;
const DEFAULT_EXPLORE_STRATEGY: RoomExploreStrategy = "frontier";
const SCROLLABLE_PANEL_CLASS = "host-controls-scrollable";

export function HostControls({
  roomId,
  roomName,
  roomMode,
  visibilitySize,
  botSpeedMultiplier,
  canEditVisibility,
  canManageBots,
  availableBotSlots,
  defaultBotNicknameBase,
  memberNicknames,
  currentBots,
  onRenameRoom,
  onSetVisibilitySize,
  onSetBotSpeedMultiplier,
  onAddBots,
  onRemoveBots
}: HostControlsProps) {
  const [draftName, setDraftName] = useState(roomName);
  const [botKind, setBotKind] = useState<RoomBotKind>("explore");
  const [botCount, setBotCount] = useState<number>(() => resolveBotCount(DEFAULT_BOT_COUNT, availableBotSlots));
  const [isBotPanelOpen, setIsBotPanelOpen] = useState(false);
  const [isStrategyTooltipOpen, setIsStrategyTooltipOpen] = useState(false);
  const [botNameDrafts, setBotNameDrafts] = useState<string[]>(() =>
    createBotNameDrafts({
      previous: [],
      count: resolveBotCount(DEFAULT_BOT_COUNT, availableBotSlots),
      defaultNicknameBase: defaultBotNicknameBase,
      usedNicknames: memberNicknames
    })
  );
  const [botStrategyDrafts, setBotStrategyDrafts] = useState<RoomExploreStrategy[]>(() =>
    createBotStrategyDrafts([], resolveBotCount(DEFAULT_BOT_COUNT, availableBotSlots))
  );
  const memberNicknamesKey = useMemo(() => memberNicknames.join("|"), [memberNicknames]);
  const defaultBotNicknameBaseKey = defaultBotNicknameBase ?? "";
  const botCountOptions = useMemo(
    () => Array.from({ length: Math.max(availableBotSlots, 0) }, (_, index) => index + 1),
    [availableBotSlots]
  );
  const canOpenBotPanel = canManageBots && (availableBotSlots > 0 || currentBots.length > 0);

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
      setIsStrategyTooltipOpen(false);
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
        defaultNicknameBase: defaultBotNicknameBase,
        usedNicknames: memberNicknames
      })
    );
  }, [availableBotSlots, botCount, defaultBotNicknameBaseKey, memberNicknamesKey, roomId]);

  useEffect(() => {
    setBotStrategyDrafts((previous) =>
      createBotStrategyDrafts(previous, resolveBotCount(botCount, availableBotSlots))
    );
  }, [availableBotSlots, botCount, roomId]);

  useEffect(() => {
    if (botKind !== "explore") {
      setIsStrategyTooltipOpen(false);
    }
  }, [botKind]);

  void draftName;
  void onRenameRoom;

  const canSubmitBots = canManageBots && availableBotSlots > 0 && botNameDrafts.some((nickname) => Boolean(normalizeNickname(nickname)));
  const botActionLabel = "봇 참가시키기";
  const canRemoveBots = canManageBots && currentBots.length > 0;

  function handleBotNameChange(index: number, value: string) {
    setBotNameDrafts((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  }

  function handleBotStrategyChange(index: number, value: RoomExploreStrategy) {
    setBotStrategyDrafts((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  }

  function handleAddBotsClick() {
    const bots: RoomBotRequest[] = [];
    for (const [index, nickname] of botNameDrafts.entries()) {
      const normalized = normalizeNickname(nickname);
      if (!normalized) {
        continue;
      }

      bots.push({
        nickname: normalized,
        kind: botKind,
        strategy: botKind === "explore" ? (botStrategyDrafts[index] ?? DEFAULT_EXPLORE_STRATEGY) : undefined
      });
    }
    if (bots.length === 0) {
      return;
    }

    onAddBots({
      kind: botKind,
      bots
    });
    setBotNameDrafts(
      createBotNameDrafts({
        previous: [],
        count: botCount,
        defaultNicknameBase: defaultBotNicknameBase,
        usedNicknames: [...memberNicknames, ...bots.map((bot) => bot.nickname)]
      })
    );
    setBotStrategyDrafts(createBotStrategyDrafts([], botCount));
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
      <style>
        {`
          .${SCROLLABLE_PANEL_CLASS} {
            scrollbar-width: thin;
            scrollbar-color: rgba(56, 189, 248, 0.55) rgba(15, 23, 42, 0.28);
          }

          .${SCROLLABLE_PANEL_CLASS}::-webkit-scrollbar {
            width: 10px;
          }

          .${SCROLLABLE_PANEL_CLASS}::-webkit-scrollbar-track {
            background: rgba(15, 23, 42, 0.22);
            border-radius: 999px;
          }

          .${SCROLLABLE_PANEL_CLASS}::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, rgba(56, 189, 248, 0.8), rgba(14, 165, 233, 0.52));
            border: 2px solid rgba(8, 15, 30, 0.92);
            border-radius: 999px;
          }

          .${SCROLLABLE_PANEL_CLASS}::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, rgba(125, 211, 252, 0.88), rgba(56, 189, 248, 0.62));
          }
        `}
      </style>

      <div style={cardStyle}>
        <div data-testid="visibility-control-row" style={visibilityControlRowStyle}>
          <label htmlFor="visibility-size" style={visibilityLabelStyle}>
            시야
          </label>
          <SelectField
            id="visibility-size"
            name="visibility-size"
            value={visibilitySize}
            disabled={!canEditVisibility}
            onChange={(event) => onSetVisibilitySize(Number(event.target.value) as 3 | 5 | 7)}
            selectStyle={selectStyle}
          >
              <option value={7}>7x7</option>
              <option value={5}>5x5</option>
              <option value={3}>3x3</option>
          </SelectField>
        </div>

        {roomMode === "bot_race" ? (
          <div data-testid="bot-speed-control-row" style={visibilityControlRowStyle}>
            <label htmlFor="bot-speed-multiplier" style={visibilityLabelStyle}>
              배속
            </label>
            <SelectField
              id="bot-speed-multiplier"
              name="bot-speed-multiplier"
              value={botSpeedMultiplier}
              disabled={!canEditVisibility}
              onChange={(event) => onSetBotSpeedMultiplier(Number(event.target.value) as RoomBotSpeedMultiplier)}
              selectStyle={selectStyle}
            >
                <option value={1}>x1</option>
                <option value={2}>x2</option>
                <option value={3}>x3</option>
                <option value={4}>x4</option>
                <option value={5}>x5</option>
                <option value={6}>x6</option>
            </SelectField>
          </div>
        ) : null}
      </div>

      <div style={botToggleWrapStyle}>
        <button
          data-testid="toggle-bot-panel-button"
          type="button"
          onClick={() => setIsBotPanelOpen((previous) => !previous)}
          disabled={!canOpenBotPanel}
          style={toggleButtonStyle}
        >
          {isBotPanelOpen ? "봇 설정 닫기" : botActionLabel}
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
                    <strong style={botTitleStyle}>{botActionLabel}</strong>
                  </div>
                  <span style={slotBadgeStyle}>남은 봇 슬롯 {availableBotSlots}명</span>
                  <button
                    data-testid="bot-panel-close-button"
                    type="button"
                    onClick={() => setIsBotPanelOpen(false)}
                    style={botCloseButtonStyle}
                  >
                    닫기
                  </button>
                </div>

                {availableBotSlots > 0 ? (
                  <>
                    <section data-testid="bot-config-section" style={botConfigSectionStyle}>
                      <div style={botConfigRowStyle}>
                        <div data-testid="bot-kind-field" style={botControlFieldStyle}>
                          <label htmlFor="bot-kind" style={botFieldLabelStyle}>
                            종류
                          </label>
                          <SelectField
                            id="bot-kind"
                            name="bot-kind"
                            value={botKind}
                            disabled={!canManageBots}
                            onChange={(event) => setBotKind(event.target.value as RoomBotKind)}
                            selectStyle={selectStyle}
                          >
                              <option value="explore">탐험형</option>
                              <option value="join">최단 경로형</option>
                          </SelectField>
                        </div>

                        <div data-testid="bot-count-field" style={botControlFieldStyle}>
                          <label htmlFor="bot-count" style={botFieldLabelStyle}>
                            수량
                          </label>
                          <SelectField
                            id="bot-count"
                            name="bot-count"
                            value={botCount}
                            disabled={!canManageBots}
                            onChange={(event) => setBotCount(Number(event.target.value))}
                            selectStyle={selectStyle}
                          >
                              {botCountOptions.map((count) => (
                                <option key={count} value={count}>
                                  {count}명
                                </option>
                              ))}
                          </SelectField>
                        </div>
                      </div>
                    </section>

                    <section data-testid="bot-names-section" style={botSectionCardStyle}>
                      <div style={botSectionHeaderStyle}>
                        <div style={botSectionTitleRowStyle}>
                          <strong style={botSectionTitleStyle}>봇 이름</strong>
                          {botKind === "explore" ? (
                            <div style={strategyTooltipWrapStyle}>
                              <button
                                data-testid="strategy-tooltip-button"
                                type="button"
                                aria-label="탐험 전략 설명"
                                aria-expanded={isStrategyTooltipOpen}
                                onClick={() => setIsStrategyTooltipOpen((previous) => !previous)}
                                style={strategyTooltipButtonStyle}
                              >
                                전략 설명
                              </button>
                              {isStrategyTooltipOpen ? (
                                <div data-testid="strategy-tooltip" role="tooltip" style={strategyTooltipStyle}>
                                  <div style={strategyTooltipSectionStyle}>
                                    <strong style={strategyTooltipLabelStyle}>Frontier</strong>
                                    <span style={strategyTooltipTextStyle}>현재 보이는 미지 경계를 넓게 찾는 기본 탐험형입니다.</span>
                                  </div>
                                  <div style={strategyTooltipSectionStyle}>
                                    <strong style={strategyTooltipLabelStyle}>Tremaux</strong>
                                    <span style={strategyTooltipTextStyle}>이미 지난 통로를 더 강하게 피해서 같은 복도 반복을 줄입니다.</span>
                                  </div>
                                  <div style={strategyTooltipSectionStyle}>
                                    <strong style={strategyTooltipLabelStyle}>Wall</strong>
                                    <span style={strategyTooltipTextStyle}>최근 진행 방향 기준으로 벽을 더듬듯 좌우 한쪽 손 우선으로 탐험합니다.</span>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <span style={botSectionMetaStyle}>기본 이름을 수정해서 바로 추가할 수 있습니다.</span>
                      </div>

                      <div className={SCROLLABLE_PANEL_CLASS} data-testid="bot-name-list" style={botInputsStyle}>
                      {botNameDrafts.map((draft, index) => (
                        <div
                          key={`${roomId}-${index}`}
                          data-testid={`bot-name-row-${index}`}
                          style={botNameRowStyle}
                        >
                          <span style={botIndexBadgeStyle}>{String(index + 1).padStart(2, "0")}</span>
                          <div style={botInputWrapStyle}>
                            <label htmlFor={`bot-name-input-${index}`} style={hiddenLabelStyle}>
                              {index + 1}번째 봇 이름
                            </label>
                            <input
                              id={`bot-name-input-${index}`}
                              data-testid={`bot-name-input-${index}`}
                              type="text"
                              maxLength={5}
                              value={draft}
                              disabled={!canManageBots}
                              onChange={(event) => handleBotNameChange(index, event.target.value)}
                              style={inputStyle}
                            />
                          </div>
                          {botKind === "explore" ? (
                            <div style={botStrategyWrapStyle}>
                              <label htmlFor={`bot-strategy-select-${index}`} style={hiddenLabelStyle}>
                                {index + 1}번째 탐험 전략
                              </label>
                              <div style={miniSelectShellStyle}>
                                <select
                                  id={`bot-strategy-select-${index}`}
                                  data-testid={`bot-strategy-select-${index}`}
                                  value={botStrategyDrafts[index] ?? DEFAULT_EXPLORE_STRATEGY}
                                  disabled={!canManageBots}
                                  onChange={(event) => handleBotStrategyChange(index, event.target.value as RoomExploreStrategy)}
                                  style={miniSelectStyle}
                                >
                                  <option value="frontier">Frontier</option>
                                  <option value="tremaux">Tremaux</option>
                                  <option value="wall">Wall</option>
                                </select>
                                <span aria-hidden="true" style={miniSelectChevronStyle}>⌄</span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    </section>

                    <button
                      data-testid="add-bots-button"
                      type="button"
                      onClick={handleAddBotsClick}
                      disabled={!canSubmitBots}
                      style={addBotsButtonStyle}
                    >
                      {botActionLabel}
                    </button>
                  </>
                ) : (
                  <div style={fullBotRoomNoticeStyle}>
                    <p style={fullBotRoomTitleStyle}>추가 가능한 슬롯이 없습니다.</p>
                    <p style={fullBotRoomMetaStyle}>현재 봇을 제거하면 새 이름으로 다시 채울 수 있습니다.</p>
                    <button
                      data-testid="add-bots-button"
                      type="button"
                      disabled
                      style={addBotsButtonStyle}
                    >
                      {botActionLabel}
                    </button>
                  </div>
                )}

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
                    <div className={SCROLLABLE_PANEL_CLASS} data-testid="current-bot-list" style={botListStyle}>
                      {currentBots.map((bot) => (
                        <div key={bot.playerId} style={botListItemStyle}>
                          <div style={botListIdentityStyle}>
                            <span style={botListNameStyle}>{bot.nickname}</span>
                            {bot.strategy ? <span style={botStrategyBadgeStyle}>{formatStrategyLabel(bot.strategy)}</span> : null}
                          </div>
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
  defaultNicknameBase?: string | null;
  usedNicknames: string[];
}) {
  const count = Math.max(0, input.count);
  if (count === 0) {
    return [];
  }
  const used = new Set(
    input.usedNicknames
      .map((nickname) => normalizeNickname(nickname))
      .filter((nickname): nickname is string => Boolean(nickname))
  );
  const drafts: string[] = [];
  let fallbackIndex = 1;
  const preferredBase = normalizeNickname(input.defaultNicknameBase);

  for (let index = 0; index < count; index += 1) {
    const candidate = normalizeNickname(input.previous[index]);
    if (candidate && !used.has(candidate) && !drafts.includes(candidate)) {
      drafts.push(candidate);
      continue;
    }

    if (index === 0 && preferredBase) {
      const preferred = uniquifyNickname(preferredBase, used, drafts);
      drafts.push(preferred);
      used.add(preferred);
      continue;
    }

    const fallback = createNextDefaultNickname(used, drafts, fallbackIndex);
    drafts.push(fallback);
    used.add(fallback);
    fallbackIndex = extractBotSuffix(fallback) + 1;
  }

  return drafts;
}

function createBotStrategyDrafts(previous: RoomExploreStrategy[], count: number) {
  return Array.from({ length: Math.max(0, count) }, (_, index) => previous[index] ?? DEFAULT_EXPLORE_STRATEGY);
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

function uniquifyNickname(rawNickname: string, used: Set<string>, drafts: string[]) {
  const nickname = rawNickname.slice(0, 5);
  if (!used.has(nickname) && !drafts.includes(nickname)) {
    return nickname;
  }

  const nicknameBase = nickname.replace(/\d+$/, "") || nickname;
  for (let suffixNumber = 2; suffixNumber < 100; suffixNumber += 1) {
    const suffix = String(suffixNumber);
    const prefixLength = Math.max(0, 5 - suffix.length);
    const candidate = `${nicknameBase.slice(0, prefixLength)}${suffix}`;
    if (!used.has(candidate) && !drafts.includes(candidate)) {
      return candidate;
    }
  }

  return nickname;
}

function extractBotSuffix(nickname: string) {
  const suffix = nickname.match(/(\d+)$/)?.[1];
  return suffix ? Number.parseInt(suffix, 10) : 1;
}

function formatStrategyLabel(strategy: RoomExploreStrategy) {
  if (strategy === "tremaux") {
    return "Tremaux";
  }

  if (strategy === "wall") {
    return "Wall";
  }

  return "Frontier";
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

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
  padding: "10px",
  borderRadius: "12px",
  background: "rgba(15, 23, 42, 0.46)",
  border: "1px solid rgba(148, 163, 184, 0.08)"
};

const visibilityControlRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  alignItems: "center",
  gap: "8px"
};

const visibilityLabelStyle: CSSProperties = {
  color: "#e2e8f0",
  fontSize: "0.78rem",
  whiteSpace: "nowrap"
};

const slotBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "24px",
  padding: "0 8px",
  borderRadius: "999px",
  background: "rgba(56, 189, 248, 0.12)",
  border: "1px solid rgba(56, 189, 248, 0.18)",
  color: "#bae6fd",
  fontSize: "0.7rem",
  whiteSpace: "nowrap"
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
  gridTemplateColumns: "minmax(0, 1fr) auto auto",
  gap: "12px",
  alignItems: "start"
};

const botHeaderStyle: CSSProperties = {
  display: "grid"
};

const botTitleStyle: CSSProperties = {
  color: "#f8fafc",
  fontSize: "0.95rem",
  letterSpacing: "-0.01em"
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

const botConfigSectionStyle: CSSProperties = {
  display: "grid",
  gap: "8px"
};

const botInputsStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  maxHeight: "220px",
  overflowY: "auto",
  paddingRight: "4px"
};

const botSectionCardStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  padding: "11px",
  borderRadius: "14px",
  background: "rgba(15, 23, 42, 0.54)",
  border: "1px solid rgba(148, 163, 184, 0.12)"
};

const botSectionHeaderStyle: CSSProperties = {
  display: "grid",
  gap: "3px"
};

const botSectionTitleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px"
};

const botSectionTitleStyle: CSSProperties = {
  color: "#f8fafc",
  fontSize: "0.8rem"
};

const botSectionMetaStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: "0.72rem",
  lineHeight: 1.4
};

const botControlFieldStyle: CSSProperties = {
  display: "grid",
  gap: "5px",
  padding: "9px",
  borderRadius: "12px",
  background: "linear-gradient(180deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.84))",
  border: "1px solid rgba(125, 211, 252, 0.12)",
  boxShadow: "inset 0 1px 0 rgba(148, 163, 184, 0.06)"
};

const botFieldLabelStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: "0.7rem",
  letterSpacing: "0.02em"
};

const botNameRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  gap: "8px",
  alignItems: "center"
};

const botIndexBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "34px",
  minHeight: "34px",
  padding: "0 8px",
  borderRadius: "10px",
  background: "rgba(30, 41, 59, 0.92)",
  border: "1px solid rgba(125, 211, 252, 0.16)",
  color: "#7dd3fc",
  fontSize: "0.72rem",
  fontVariantNumeric: "tabular-nums"
};

const botInputWrapStyle: CSSProperties = {
  minWidth: 0,
  padding: "2px",
  borderRadius: "12px",
  background: "rgba(8, 15, 30, 0.92)",
  border: "1px solid rgba(56, 189, 248, 0.12)",
  boxShadow: "inset 0 1px 0 rgba(148, 163, 184, 0.05)"
};

const botStrategyWrapStyle: CSSProperties = {
  minWidth: "112px"
};

const strategyTooltipWrapStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0
};

const strategyTooltipButtonStyle: CSSProperties = {
  minHeight: "24px",
  padding: "3px 8px",
  borderRadius: "999px",
  border: "1px solid rgba(125, 211, 252, 0.2)",
  background: "rgba(56, 189, 248, 0.08)",
  color: "#bae6fd",
  cursor: "pointer",
  fontSize: "0.68rem",
  whiteSpace: "nowrap"
};

const strategyTooltipStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  zIndex: 2,
  display: "grid",
  gap: "8px",
  width: "220px",
  padding: "10px",
  borderRadius: "12px",
  border: "1px solid rgba(125, 211, 252, 0.16)",
  background: "rgba(8, 15, 30, 0.98)",
  boxShadow: "0 18px 40px rgba(2, 6, 23, 0.36)"
};

const strategyTooltipSectionStyle: CSSProperties = {
  display: "grid",
  gap: "3px"
};

const strategyTooltipLabelStyle: CSSProperties = {
  color: "#f8fafc",
  fontSize: "0.74rem"
};

const strategyTooltipTextStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: "0.7rem",
  lineHeight: 1.45
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
  gap: "8px",
  maxHeight: "220px",
  overflowY: "auto",
  paddingRight: "4px"
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

const botListIdentityStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minWidth: 0,
  flexWrap: "wrap"
};

const botListNameStyle: CSSProperties = {
  color: "#f8fafc",
  fontSize: "0.82rem"
};

const botStrategyBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "20px",
  padding: "0 8px",
  borderRadius: "999px",
  border: "1px solid rgba(96, 165, 250, 0.26)",
  background: "rgba(37, 99, 235, 0.16)",
  color: "#bfdbfe",
  fontSize: "0.68rem",
  fontWeight: 700,
  letterSpacing: "0.02em"
};

const botEmptyTextStyle: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "0.76rem"
};

const fullBotRoomNoticeStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
  padding: "10px 11px",
  borderRadius: "12px",
  background: "rgba(15, 23, 42, 0.52)",
  border: "1px solid rgba(148, 163, 184, 0.1)"
};

const fullBotRoomTitleStyle: CSSProperties = {
  margin: 0,
  color: "#e2e8f0",
  fontSize: "0.8rem"
};

const fullBotRoomMetaStyle: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "0.74rem",
  lineHeight: 1.45
};

const selectStyle: CSSProperties = {
  ...baseSelectStyle
};

const miniSelectShellStyle: CSSProperties = {
  position: "relative",
  minWidth: 0
};

const miniSelectStyle: CSSProperties = {
  width: "100%",
  minHeight: "36px",
  padding: "8px 30px 8px 10px",
  borderRadius: "10px",
  border: "1px solid rgba(15, 23, 42, 0.16)",
  background: "linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(30, 41, 59, 0.82))",
  color: "#cbd5e1",
  fontSize: "0.74rem",
  fontWeight: 600,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  boxSizing: "border-box"
};

const miniSelectChevronStyle: CSSProperties = {
  position: "absolute",
  right: "8px",
  top: "50%",
  transform: "translateY(-50%)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "16px",
  height: "16px",
  borderRadius: "999px",
  background: "rgba(56, 189, 248, 0.14)",
  color: "#7dd3fc",
  fontSize: "0.68rem",
  pointerEvents: "none"
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: "36px",
  padding: "8px 10px",
  borderRadius: "10px",
  border: "1px solid rgba(15, 23, 42, 0.2)",
  background: "rgba(15, 23, 42, 0.96)",
  color: "#f8fafc",
  fontSize: "0.85rem",
  boxSizing: "border-box"
};

const addBotsButtonStyle: CSSProperties = {
  minHeight: "38px",
  padding: "9px 12px",
  borderRadius: "12px",
  border: "1px solid rgba(56, 189, 248, 0.24)",
  background: "linear-gradient(180deg, rgba(56, 189, 248, 0.22), rgba(14, 165, 233, 0.16))",
  color: "#e0f2fe",
  cursor: "pointer",
  fontSize: "0.82rem",
  fontWeight: 600,
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
  width: "100%",
  minHeight: "30px",
  padding: "5px 10px",
  borderRadius: "10px",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: "rgba(15, 23, 42, 0.7)",
  color: "#cbd5e1",
  cursor: "pointer",
  fontSize: "0.74rem",
  whiteSpace: "nowrap"
};

const botToggleWrapStyle: CSSProperties = {
  display: "grid"
};
