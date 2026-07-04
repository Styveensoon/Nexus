import React, { useCallback, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, BadgeCheck, ChevronRight, Plus, Search, Sparkles, Trash2, X } from "lucide-react-native";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import BadgeAwardModal from "../components/BadgeAwardModal";
import CreateBadgeModal from "../components/CreateBadgeModal";
import { listOrganizationMembers, OrganizationMemberProfile } from "../lib/organizations";
import { listTeams, Team } from "../lib/teams";
import {
  BadgeDefinition,
  BadgeSuggestion,
  ProfileBadge,
  createBadgeDefinition,
  deleteBadgeDefinition,
  getBadgeDefinition,
  grantBadge,
  listOrgBadgeDefinitions,
  listOrgBadges,
  requestBadgeSuggestions,
  revokeBadge,
} from "../lib/badges";
import { BADGE_ICONS } from "../components/BadgePill";

const AZURE_DEEP = "#2C7BD1";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export default function BadgesScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { user, organization, loading: authLoading } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";
  const isOwner = !!organization && organization.owner_id === user?.id;

  const bg            = isDark ? "#0B1220" : "#F1F5FA";
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.58)" : "rgba(255, 255, 255, 0.6)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = organization?.color ?? AZURE_DEEP;
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const dangerColor   = "#EF4444";

  const ultraShadow = {
    ...Platform.select({
      web: {
        boxShadow: isDark
          ? "0 30px 60px -25px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.08) inset"
          : "0 30px 60px -22px rgba(44,123,209,0.18), 0 1px 0 rgba(255,255,255,0.9) inset",
        backdropFilter: "blur(32px) saturate(200%)",
      } as any,
      default: {
        shadowColor: isDark ? "#000" : "#2C7BD1",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: isDark ? 0.35 : 0.1,
        shadowRadius: 22,
        elevation: 6,
      },
    }),
    borderTopColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.9)",
  };

  const [members, setMembers] = useState<OrganizationMemberProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [badgesByProfile, setBadgesByProfile] = useState<Map<string, ProfileBadge[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [modalErrorText, setModalErrorText] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<BadgeSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestionBusyId, setSuggestionBusyId] = useState<string | null>(null);
  const [suggestionActionError, setSuggestionActionError] = useState<string | null>(null);

  // CRUD de badges (Punto 5 del feedback): catálogo real = fijo (BADGE_CATALOG)
  // + los personalizados de esta organización (badge_definitions).
  const [catalog, setCatalog] = useState<BadgeDefinition[]>([]);
  const [showCreateBadge, setShowCreateBadge] = useState(false);
  const [creatingBadge, setCreatingBadge] = useState(false);
  const [createBadgeError, setCreateBadgeError] = useState<string | null>(null);
  const [confirmDeleteBadgeKey, setConfirmDeleteBadgeKey] = useState<string | null>(null);
  const [deletingBadgeKey, setDeletingBadgeKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!organization) return;
    setLoading(true);
    setErrorText(null);

    const [membersRes, teamsRes, badgesRes, catalogRes] = await Promise.all([
      listOrganizationMembers(organization.id),
      listTeams(organization.id),
      listOrgBadges(organization.id),
      listOrgBadgeDefinitions(organization.id),
    ]);

    if (membersRes.error || teamsRes.error || badgesRes.error) {
      setErrorText("No se pudieron cargar los datos de badges.");
    }
    setMembers(membersRes.data);
    setTeams(teamsRes.data);
    setBadgesByProfile(badgesRes.data);
    setCatalog(catalogRes.data);
    setLoading(false);
  }, [organization]);

  const customBadges = catalog.filter((b) => b.key.startsWith("custom_"));

  const handleCreateBadge = async (params: { label: string; description: string; icon: string; color: string }) => {
    if (!organization || !user) return;
    setCreatingBadge(true);
    setCreateBadgeError(null);
    const { error } = await createBadgeDefinition({ organizationId: organization.id, createdBy: user.id, ...params });
    setCreatingBadge(false);
    if (error) {
      setCreateBadgeError("No se pudo crear el badge. Intenta de nuevo.");
      return;
    }
    await loadData();
    setShowCreateBadge(false);
  };

  const handleDeleteBadge = async (key: string) => {
    if (!organization) return;
    setDeletingBadgeKey(key);
    const { error } = await deleteBadgeDefinition(organization.id, key);
    setDeletingBadgeKey(null);
    setConfirmDeleteBadgeKey(null);
    if (!error) setCatalog((prev) => prev.filter((b) => b.key !== key));
  };

  // useFocusEffect (no useEffect) para refrescar cada vez que se vuelve a esta
  // pantalla, mismo criterio que el resto de las pestañas del Dashboard.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const myLeaderTeams = useMemo(() => teams.filter((t) => t.leaderId === user?.id), [teams, user]);

  const managedMemberIds = useMemo(() => {
    if (isOwner) return null;
    const set = new Set<string>();
    myLeaderTeams.forEach((t) => t.members.forEach((m) => set.add(m.userId)));
    return set;
  }, [isOwner, myLeaderTeams]);

  const canManageAny = isOwner || myLeaderTeams.length > 0;

  const canManageMember = useCallback(
    (profileId: string) => isOwner || (managedMemberIds?.has(profileId) ?? false),
    [isOwner, managedMemberIds]
  );

  const filteredMembers = members.filter((m) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return m.name.toLowerCase().includes(query) || (m.customRole || m.role || "").toLowerCase().includes(query);
  });

  const selectedMember = members.find((m) => m.userId === selectedMemberId) ?? null;
  const selectedGrantedBadges = selectedMemberId ? badgesByProfile.get(selectedMemberId) ?? [] : [];
  // Para las entradas optimistas de abajo: quien otorga siempre es el
  // usuario actual, así que resolvemos su nombre del roster ya cargado en
  // vez de disparar una query extra solo para eso.
  const myName = members.find((m) => m.userId === user?.id)?.name ?? "Tú";

  const openMemberModal = (memberId: string) => {
    setModalErrorText(null);
    setSelectedMemberId(memberId);
  };

  const closeMemberModal = () => {
    setSelectedMemberId(null);
    setModalErrorText(null);
  };

  const handleGrant = async (badgeKey: string) => {
    if (!organization || !user || !selectedMemberId) return;
    setBusyKey(badgeKey);
    setModalErrorText(null);
    const { error } = await grantBadge({ organizationId: organization.id, profileId: selectedMemberId, badgeKey, grantedBy: user.id });
    if (error) {
      setModalErrorText("No se pudo otorgar el badge. Intenta de nuevo.");
    } else {
      setBadgesByProfile((prev) => {
        const next = new Map(prev);
        const list = next.get(selectedMemberId) ?? [];
        next.set(selectedMemberId, [
          ...list,
          { id: `local-${badgeKey}`, organizationId: organization.id, profileId: selectedMemberId, badgeKey, grantedBy: user.id, grantedByName: myName, createdAt: new Date().toISOString() },
        ]);
        return next;
      });
    }
    setBusyKey(null);
  };

  const handleRevoke = async (badgeKey: string) => {
    if (!organization || !selectedMemberId) return;
    setBusyKey(badgeKey);
    setModalErrorText(null);
    const { error } = await revokeBadge({ organizationId: organization.id, profileId: selectedMemberId, badgeKey });
    if (error) {
      setModalErrorText("No se pudo quitar el badge. Intenta de nuevo.");
    } else {
      setBadgesByProfile((prev) => {
        const next = new Map(prev);
        const list = (next.get(selectedMemberId) ?? []).filter((b) => b.badgeKey !== badgeKey);
        next.set(selectedMemberId, list);
        return next;
      });
    }
    setBusyKey(null);
  };

  const handleAskSuggestions = async () => {
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    const { data, error } = await requestBadgeSuggestions(organization!.id);
    if (error) {
      setSuggestionsError(error.message ?? "No se pudo conectar con la IA.");
      setSuggestions([]);
    } else {
      // Filtra client-side sugerencias obsoletas: badge ya otorgado, o persona
      // fuera del alcance de quien pidió (defensa extra, la Edge Function ya
      // debería acotar el roster si quien pide no es el owner).
      const filtered = data.filter((s) => {
        const alreadyHas = (badgesByProfile.get(s.userId) ?? []).some((b) => b.badgeKey === s.badgeKey);
        return !alreadyHas && canManageMember(s.userId) && !!getBadgeDefinition(s.badgeKey);
      });
      setSuggestions(filtered);
    }
    setSuggestionsLoading(false);
  };

  const dismissSuggestion = (index: number) => {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  };

  const grantFromSuggestion = async (suggestion: BadgeSuggestion, index: number) => {
    if (!organization || !user) return;
    const busyId = `${suggestion.userId}-${suggestion.badgeKey}`;
    setSuggestionBusyId(busyId);
    setSuggestionActionError(null);
    const { error } = await grantBadge({
      organizationId: organization.id,
      profileId: suggestion.userId,
      badgeKey: suggestion.badgeKey,
      grantedBy: user.id,
    });
    if (error) {
      setSuggestionActionError("No se pudo otorgar el badge sugerido. Intenta de nuevo.");
    } else {
      setBadgesByProfile((prev) => {
        const next = new Map(prev);
        const list = next.get(suggestion.userId) ?? [];
        next.set(suggestion.userId, [
          ...list,
          { id: `local-${suggestion.badgeKey}`, organizationId: organization.id, profileId: suggestion.userId, badgeKey: suggestion.badgeKey, grantedBy: user.id, grantedByName: myName, createdAt: new Date().toISOString() },
        ]);
        return next;
      });
      dismissSuggestion(index);
    }
    setSuggestionBusyId(null);
  };

  if (authLoading) {
    return (
      <View style={[styles.container, { backgroundColor: bg, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: textSecondary }}>Cargando…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg, overflow: "hidden" }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
        <View style={{ width: "100%", maxWidth: 1280, alignSelf: "center" }}>
          <View style={styles.header}>
            <TouchableOpacity activeOpacity={0.8} style={[styles.backBtn, { backgroundColor: cardBg, borderColor: border }]} onPress={() => navigation.goBack()}>
              <ArrowLeft size={18} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.subtitle, { color: textSecondary }]}>{organization?.name ?? "Workspace"}</Text>
              <Text style={[styles.title, { color: textPrimary }]}>Badges</Text>
            </View>
          </View>

          {!organization ? (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border, marginTop: 24 }, ultraShadow]}>
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>Tu cuenta no tiene un workspace todavía</Text>
            </View>
          ) : (
            <>
              {isOwner && (
                <View style={[styles.customBadgesCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
                  <View style={styles.customBadgesHeader}>
                    <Text style={[styles.aiTitle, { color: textPrimary }]}>Tus badges personalizados</Text>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[styles.createBadgeBtn, { backgroundColor: primaryColor }]}
                      onPress={() => {
                        setCreateBadgeError(null);
                        setShowCreateBadge(true);
                      }}
                    >
                      <Plus size={14} color="#FFF" strokeWidth={2.3} />
                      <Text style={styles.createBadgeBtnText}>Crear badge</Text>
                    </TouchableOpacity>
                  </View>

                  {customBadges.length === 0 ? (
                    <Text style={[styles.aiDesc, { color: textSecondary, marginTop: 10 }]}>
                      Además de los 10 badges de fábrica, puedes crear los que quieras para tu organización.
                    </Text>
                  ) : (
                    <View style={[styles.chipsRow, { marginTop: 12 }]}>
                      {customBadges.map((badge) => {
                        const Icon = BADGE_ICONS[badge.icon] ?? BadgeCheck;
                        const isConfirming = confirmDeleteBadgeKey === badge.key;
                        const isBusy = deletingBadgeKey === badge.key;
                        if (isConfirming) {
                          return (
                            <View key={badge.key} style={[styles.confirmPill, { borderColor: dangerColor, backgroundColor: inputBg }]}>
                              <Text style={{ color: textPrimary, fontSize: 11.5, fontWeight: "700" }} numberOfLines={1}>
                                ¿Borrar "{badge.label}"?
                              </Text>
                              <TouchableOpacity
                                activeOpacity={0.85}
                                disabled={isBusy}
                                onPress={() => handleDeleteBadge(badge.key)}
                                style={[styles.confirmPillBtn, { backgroundColor: dangerColor, opacity: isBusy ? 0.6 : 1 }]}
                              >
                                <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "700" }}>Borrar</Text>
                              </TouchableOpacity>
                              <TouchableOpacity hitSlop={6} onPress={() => setConfirmDeleteBadgeKey(null)}>
                                <X size={13} color={textSecondary} strokeWidth={2.2} />
                              </TouchableOpacity>
                            </View>
                          );
                        }
                        return (
                          <View key={badge.key} style={[styles.grantedPill, { backgroundColor: badge.color }]}>
                            <Icon size={13} color="#FFF" strokeWidth={2.2} />
                            <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>{badge.label}</Text>
                            <TouchableOpacity hitSlop={6} onPress={() => setConfirmDeleteBadgeKey(badge.key)}>
                              <Trash2 size={13} color="#FFF" strokeWidth={2.2} />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {canManageAny && (
                <View style={[styles.aiCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
                  <View style={styles.aiHeader}>
                    <View style={[styles.aiIcon, { backgroundColor: isDark ? "rgba(126,200,245,0.14)" : "rgba(44,123,209,0.08)" }]}>
                      <Sparkles size={18} color={primaryColor} strokeWidth={2.3} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.aiTitle, { color: textPrimary }]}>Sugerencias de IA</Text>
                      <Text style={[styles.aiDesc, { color: textSecondary }]}>
                        Analiza tasks completadas, liderazgo y participación reciente para sugerir a quién reconocer.
                      </Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      disabled={suggestionsLoading}
                      style={[styles.aiBtn, { backgroundColor: primaryColor, opacity: suggestionsLoading ? 0.6 : 1 }]}
                      onPress={handleAskSuggestions}
                    >
                      <Text style={styles.aiBtnText}>{suggestionsLoading ? "Analizando…" : "Analizar desempeño"}</Text>
                    </TouchableOpacity>
                  </View>

                  {suggestionsError && (
                    <Text style={[styles.errorText, { color: dangerColor, marginTop: 12 }]}>{suggestionsError}</Text>
                  )}
                  {suggestionActionError && (
                    <Text style={[styles.errorText, { color: dangerColor, marginTop: 12 }]}>{suggestionActionError}</Text>
                  )}

                  {!suggestionsLoading && !suggestionsError && suggestions.length === 0 && (
                    <Text style={[styles.aiEmptyText, { color: textSecondary }]}>
                      Todavía no pediste un análisis, o no encontró a nadie que ya no tenga el badge sugerido.
                    </Text>
                  )}

                  {suggestions.length > 0 && (
                    <View style={{ gap: 10, marginTop: 16 }}>
                      {suggestions.map((s, index) => {
                        const badge = getBadgeDefinition(s.badgeKey);
                        const member = members.find((m) => m.userId === s.userId);
                        if (!badge || !member) return null;
                        const busyId = `${s.userId}-${s.badgeKey}`;
                        const isBusy = suggestionBusyId === busyId;
                        return (
                          <View key={busyId} style={[styles.suggestionRow, { backgroundColor: inputBg, borderColor: border }]}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.suggestionName, { color: textPrimary }]}>
                                {member.name} · <Text style={{ color: badge.color }}>{badge.label}</Text>
                              </Text>
                              <Text style={[styles.suggestionReason, { color: textSecondary }]}>{s.reason}</Text>
                            </View>
                            <TouchableOpacity
                              activeOpacity={0.85}
                              disabled={isBusy}
                              style={[styles.suggestionGrantBtn, { backgroundColor: badge.color, opacity: isBusy ? 0.6 : 1 }]}
                              onPress={() => grantFromSuggestion(s, index)}
                            >
                              <Text style={styles.suggestionGrantBtnText}>{isBusy ? "…" : "Otorgar"}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity hitSlop={8} onPress={() => dismissSuggestion(index)}>
                              <X size={16} color={textSecondary} strokeWidth={2.2} />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              <View style={[styles.searchWrapper, { backgroundColor: inputBg, borderColor: border, marginTop: 20 }]}>
                <Search size={18} color={textSecondary} strokeWidth={2.3} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar colaborador…"
                  placeholderTextColor={textSecondary}
                  style={[styles.searchInput, { color: textPrimary }, isWeb && styles.noOutline]}
                />
              </View>

              {errorText && <Text style={[styles.errorText, { color: dangerColor }]}>{errorText}</Text>}

              {loading ? (
                <Text style={{ color: textSecondary, marginTop: 24 }}>Cargando colaboradores…</Text>
              ) : filteredMembers.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border, marginTop: 20 }, ultraShadow]}>
                  <BadgeCheck size={32} color={textSecondary} strokeWidth={2} />
                  <Text style={[styles.emptyTitle, { color: textPrimary }]}>
                    {members.length === 0 ? "Todavía no hay colaboradores en tu organización" : "Nadie coincide con esa búsqueda"}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={{ marginTop: 20, maxHeight: 560 }}
                  contentContainerStyle={{ gap: 12 }}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {filteredMembers.map((member) => {
                    const badgeCount = (badgesByProfile.get(member.userId) ?? []).length;
                    return (
                      <TouchableOpacity
                        key={member.userId}
                        activeOpacity={0.85}
                        style={[styles.memberCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}
                        onPress={() => openMemberModal(member.userId)}
                      >
                        <View style={[styles.avatar, { backgroundColor: member.avatarColor }]}>
                          <Text style={styles.avatarText}>{initials(member.name)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.memberName, { color: textPrimary }]} numberOfLines={1}>
                            {member.name}
                          </Text>
                          <Text style={[styles.memberRole, { color: textSecondary }]} numberOfLines={1}>
                            {member.customRole || member.role || "Sin rol asignado"}
                          </Text>
                        </View>
                        <View style={[styles.badgeCountPill, { backgroundColor: isDark ? "rgba(126,200,245,0.14)" : "rgba(44,123,209,0.08)" }]}>
                          <BadgeCheck size={13} color={primaryColor} strokeWidth={2.2} />
                          <Text style={[styles.badgeCountText, { color: primaryColor }]}>{badgeCount}</Text>
                        </View>
                        <ChevronRight size={18} color={textSecondary} strokeWidth={2.2} />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      <BadgeAwardModal
        visible={!!selectedMemberId}
        member={selectedMember}
        isDark={isDark}
        catalog={catalog}
        grantedBadges={selectedGrantedBadges}
        canManage={selectedMemberId ? canManageMember(selectedMemberId) : false}
        busyKey={busyKey}
        errorText={modalErrorText}
        onClose={closeMemberModal}
        onGrant={handleGrant}
        onRevoke={handleRevoke}
      />

      <CreateBadgeModal
        visible={showCreateBadge}
        isDark={isDark}
        saving={creatingBadge}
        errorText={createBadgeError}
        onClose={() => setShowCreateBadge(false)}
        onCreate={handleCreateBadge}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  subtitle: { fontSize: 13, fontWeight: "600" },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.5, marginTop: 2 },

  customBadgesCard: { borderRadius: 26, borderWidth: 1, padding: 20, marginTop: 24 },
  customBadgesHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  createBadgeBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  createBadgeBtnText: { color: "#FFF", fontWeight: "700", fontSize: 12.5 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  grantedPill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  confirmPill: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, borderWidth: 1.5, paddingVertical: 6, paddingHorizontal: 10, maxWidth: 260 },
  confirmPillBtn: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },

  aiCard: { borderRadius: 26, borderWidth: 1, padding: 20, marginTop: 24 },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 14 },
  aiIcon: { width: 40, height: 40, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  aiTitle: { fontSize: 15, fontWeight: "700" },
  aiDesc: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  aiBtn: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 },
  aiBtnText: { color: "#FFF", fontWeight: "700", fontSize: 12.5 },
  aiEmptyText: { fontSize: 12.5, lineHeight: 18, marginTop: 14 },

  suggestionRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 16, padding: 12 },
  suggestionName: { fontSize: 13, fontWeight: "700" },
  suggestionReason: { fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  suggestionGrantBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  suggestionGrantBtnText: { color: "#FFF", fontWeight: "700", fontSize: 12 },

  searchWrapper: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16 },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 15 },
  noOutline: { outlineStyle: "none" } as any,

  errorText: { marginTop: 16, fontSize: 13, fontWeight: "600" },

  emptyCard: { borderRadius: 24, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700", textAlign: "center" },

  memberCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 24, borderWidth: 1, padding: 16 },
  avatar: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  memberName: { fontSize: 14, fontWeight: "700" },
  memberRole: { fontSize: 12, marginTop: 2 },
  badgeCountPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  badgeCountText: { fontSize: 12, fontWeight: "700" },
});
