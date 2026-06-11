import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import { useMe } from "../hooks/useMe";
import { useHomeSections } from "../hooks/useHomeSections";
import { useAlbums } from "../hooks/useAlbums";
import { useAccessRequests } from "../hooks/useAccessRequests";
import { useAccounts } from "../hooks/useAccounts";

const cardStyle = {
  background: "var(--card-surface)",
  border: "1px solid var(--card-border)",
  borderRadius: 18,
  boxShadow: "var(--shadow-soft)",
};

const TAB_DEFINITIONS = {
  home: { id: "home", label: "主页" },
  albums: { id: "albums", label: "相册" },
  requests: { id: "requests", label: "访客申请" },
  accounts: { id: "accounts", label: "账号管理" },
  view: { id: "view", label: "视图控制" },
};

function TabSwitcher({ activeTab, onChange, options }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
      {options.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={activeTab === tab.id ? "button-primary" : "button-secondary"}
          style={{ padding: "8px 18px" }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function HomeTab() {
  const queryClient = useQueryClient();
  const { data: sections, isLoading: sectionsLoading } = useHomeSections();
  const { data: albums, isLoading: albumsLoading } = useAlbums();
  const [selectedId, setSelectedId] = useState(null);
  const [feedback, setFeedback] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newRows, setNewRows] = useState(1);

  const [localSections, setLocalSections] = useState([]);
  const [draggingId, setDraggingId] = useState(null);

  const selectedSection = useMemo(
    () => localSections.find((item) => item.id === selectedId) ?? null,
    [localSections, selectedId]
  );

  const [titleDraft, setTitleDraft] = useState("");
  const [rowsDraft, setRowsDraft] = useState(1);
  const [albumSelection, setAlbumSelection] = useState([]);

  useEffect(() => {
    if (sections) {
      setLocalSections(sections.map((item) => ({ ...item })));
    }
  }, [sections]);

  useEffect(() => {
    if (!sectionsLoading) {
      if (localSections && localSections.length > 0) {
        if (!selectedId || !localSections.some((item) => item.id === selectedId)) {
          setSelectedId(localSections[0].id);
        }
      } else {
        setSelectedId(null);
      }
    }
  }, [localSections, sectionsLoading, selectedId]);

  useEffect(() => {
    if (selectedSection) {
      setTitleDraft(selectedSection.title);
      setRowsDraft(selectedSection.preview_rows || 1);
      setAlbumSelection(selectedSection.album_ids || []);
    } else {
      setTitleDraft("");
      setRowsDraft(1);
      setAlbumSelection([]);
    }
  }, [selectedSection]);

  const createSection = useMutation({
    mutationFn: (payload) => api.post("/home-sections", payload),
    onSuccess: (data) => {
      setFeedback("分类创建成功");
      setNewTitle("");
      setNewRows(1);
      queryClient.invalidateQueries(["home-sections"]);
      if (data?.id) {
        setSelectedId(data.id);
      }
    },
    onError: (err) => setFeedback(err?.message || "分类创建失败"),
  });

  const updateSection = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/home-sections/${id}`, payload),
    onSuccess: () => {
      setFeedback("分类已更新");
      queryClient.invalidateQueries(["home-sections"]);
    },
    onError: (err) => setFeedback(err?.message || "更新失败"),
  });

  const updateSectionAlbums = useMutation({
    mutationFn: ({ id, albumIds }) => api.put(`/home-sections/${id}/albums`, { album_ids: albumIds }),
    onSuccess: () => {
      setFeedback("挂载相册已保存");
      queryClient.invalidateQueries(["home-sections"]);
    },
    onError: (err) => setFeedback(err?.message || "保存失败"),
  });

  const reorderMutation = useMutation({
    mutationFn: (order) => api.put("/home-sections/reorder", { order }),
    onSuccess: () => {
      setFeedback("分类顺序已更新");
      queryClient.invalidateQueries(["home-sections"]);
    },
    onError: (err) => {
      setFeedback(err?.message || "分类排序保存失败");
      queryClient.invalidateQueries(["home-sections"]);
    },
  });

  const deleteSection = useMutation({
    mutationFn: (id) => api.delete(`/home-sections/${id}`),
    onSuccess: (_, id) => {
      setFeedback("分类已删除");
      if (selectedId === id) {
        setSelectedId(null);
        setAlbumSelection([]);
      }
      queryClient.invalidateQueries(["home-sections"]);
    },
    onError: (err) => setFeedback(err?.message || "删除失败"),
  });

  const albumOptions = useMemo(() => albums || [], [albums]);

  const onToggleAlbum = (albumId) => {
    setAlbumSelection((prev) => {
      if (prev.includes(albumId)) {
        return prev.filter((id) => id !== albumId);
      }
      return [...prev, albumId];
    });
  };

  const reorderSections = (sourceId, targetId) => {
    if (sourceId === targetId) return;
    const items = [...localSections];
    const fromIndex = items.findIndex((item) => item.id === sourceId);
    const toIndex = items.findIndex((item) => item.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    setLocalSections(items);
    reorderMutation.mutate(items.map((item) => item.id));
  };

  const parseRowsValue = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      return 1;
    }
    return Math.min(2, Math.max(1, parsed));
  };

  const handleCreateSection = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) {
      setFeedback("请输入分类标题");
      return;
    }
    createSection.mutate({ title: trimmed, preview_rows: newRows });
  };

  const handleSaveBasics = () => {
    if (!selectedSection) {
      return;
    }
    const payload = {};
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== selectedSection.title) {
      payload.title = trimmed;
    }
    if (rowsDraft !== selectedSection.preview_rows) {
      payload.preview_rows = rowsDraft;
    }
    if (Object.keys(payload).length === 0) {
      setFeedback("没有可保存的更改");
      return;
    }
    updateSection.mutate({ id: selectedSection.id, payload });
  };

  const handleSaveAlbums = () => {
    if (!selectedSection) {
      return;
    }
    updateSectionAlbums.mutate({ id: selectedSection.id, albumIds: albumSelection });
  };

  const handleDeleteSection = (sectionId) => {
    if (window.confirm("确定删除该首页分类吗？")) {
      deleteSection.mutate(sectionId);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
      <div>
        <div style={{ ...cardStyle, padding: 16, marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, marginBottom: 12 }}>新增分类</h3>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="分类标题，如 照片"
            style={{ width: "100%", marginBottom: 12 }}
          />
          <label style={{ fontSize: 13, color: "rgba(50,44,84,0.7)", display: "block", marginBottom: 8 }}>
            首页预览排数
          </label>
          <select
            value={newRows}
            onChange={(e) => setNewRows(parseRowsValue(e.target.value))}
            style={{ width: "100%", marginBottom: 12 }}
          >
            <option value={1}>一排（4 个预览）</option>
            <option value={2}>两排（8 个预览）</option>
          </select>
          <button
            type="button"
            className="button-primary"
            onClick={handleCreateSection}
            disabled={createSection.isPending}
            style={{ width: "100%" }}
          >
            {createSection.isPending ? "创建中…" : "创建分类"}
          </button>
        </div>

        <div style={{ ...cardStyle, padding: 16, maxHeight: 480, overflowY: "auto" }}>
          <h3 style={{ fontSize: 18, marginBottom: 12 }}>分类列表</h3>
          {sectionsLoading ? (
            <div>加载分类中…</div>
          ) : localSections && localSections.length > 0 ? (
            <ul style={{ display: "grid", gap: 8 }}>
              {localSections.map((section) => {
                const isSelected = selectedId === section.id;
                const isDragging = draggingId === section.id;
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(section.id)}
                      className={isSelected ? "button-primary" : "button-secondary"}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(section.id));
                        setDraggingId(section.id);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const sourceId = Number.parseInt(event.dataTransfer.getData("text/plain"), 10);
                        if (Number.isFinite(sourceId)) {
                          reorderSections(sourceId, section.id);
                        }
                        setDraggingId(null);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        opacity: reorderMutation.isPending ? 0.75 : 1,
                        borderStyle: isDragging ? "dashed" : undefined,
                      }}
                    >
                      <span>{section.title}</span>
                      <span style={{ fontSize: 12, color: "rgba(50,44,84,0.65)" }}>
                        {section.album_ids?.length || 0} 个相册
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div style={{ color: "rgba(50,44,84,0.6)" }}>暂无分类，请先新增。</div>
          )}
        </div>
      </div>

      <div style={{ ...cardStyle, padding: 24 }}>
        {feedback && (
          <div style={{ marginBottom: 16, color: "var(--brand-ink)" }}>{feedback}</div>
        )}

        {selectedSection ? (
          <div>
            <header style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 22, marginBottom: 6 }}>配置「{selectedSection.title}」</h3>
              <div style={{ fontSize: 13, color: "rgba(50,44,84,0.65)" }}>唯一键：{selectedSection.key}</div>
            </header>

            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>显示名称</label>
                <input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} style={{ width: "100%" }} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>首页预览排数</label>
                <select
                  value={rowsDraft}
                  onChange={(e) => setRowsDraft(parseRowsValue(e.target.value))}
                  style={{ width: 220 }}
                >
                  <option value={1}>一排（4 个预览）</option>
                  <option value={2}>两排（8 个预览）</option>
                </select>
                <div style={{ fontSize: 12, color: "rgba(50,44,84,0.6)", marginTop: 6 }}>
                  实际展示数量 = 排数 × 4，当前将展示 {rowsDraft * 4} 个预览项目。
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>挂载相册</label>
                <div style={{ fontSize: 12, color: "rgba(50,44,84,0.6)", marginBottom: 8 }}>
                  分类不会直接添加媒体，勾选后会展示所选相册中的最新内容。
                </div>
                {albumsLoading ? (
                  <div>加载相册中…</div>
                ) : albumOptions.length > 0 ? (
                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                    {albumOptions.map((album) => {
                      const checked = albumSelection.includes(album.id);
                      return (
                        <label key={album.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleAlbum(album.id)}
                          />
                          <span>
                            {album.title}
                            <span style={{ fontSize: 12, color: "rgba(50,44,84,0.55)", marginLeft: 6 }}>
                              {album.media_count ?? 0} 媒体
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ color: "rgba(50,44,84,0.6)" }}>
                    还没有任何相册，先在「相册」标签中新建，或通过
                    {" "}
                    <Link to="/upload" style={{ color: "var(--brand-ink)" }}>上传页</Link>
                    {" "}
                    添加媒体。
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button type="button" className="button-primary" onClick={handleSaveBasics} disabled={updateSection.isPending}>
                {updateSection.isPending ? "保存中…" : "保存基本信息"}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={handleSaveAlbums}
                disabled={updateSectionAlbums.isPending}
              >
                {updateSectionAlbums.isPending ? "保存中…" : "保存挂载相册"}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => handleDeleteSection(selectedSection.id)}
                disabled={deleteSection.isPending}
                style={{ marginLeft: "auto", color: "#dc2626", borderColor: "rgba(220,38,38,0.4)" }}
              >
                删除分类
              </button>
            </div>
          </div>
        ) : (
          <div style={{ color: "rgba(50,44,84,0.6)" }}>请选择左侧的分类进行配置。</div>
        )}
      </div>
    </div>
  );
}

function AlbumsTab() {
  const queryClient = useQueryClient();
  const { data: albums, isLoading: albumsLoading, isError, error } = useAlbums();
  const [selectedId, setSelectedId] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newVisibility, setNewVisibility] = useState("private");

  const selectedAlbum = useMemo(() => albums?.find((item) => item.id === selectedId) ?? null, [albums, selectedId]);
  const [titleDraft, setTitleDraft] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    if (albums && albums.length > 0) {
      if (!selectedId || !albums.some((item) => item.id === selectedId)) {
        setSelectedId(albums[0].id);
      }
    } else {
      setSelectedId(null);
    }
  }, [albums, selectedId]);

  useEffect(() => {
    if (selectedAlbum) {
      setTitleDraft(selectedAlbum.title);
      setIsRenaming(false);
    }
  }, [selectedAlbum]);

  const createAlbum = useMutation({
    mutationFn: (payload) => api.post("/albums", payload),
    onSuccess: (data) => {
      setFeedback("相册创建成功");
      setNewTitle("");
      setNewVisibility("private");
      queryClient.invalidateQueries(["albums"]);
      queryClient.invalidateQueries(["home-sections"]);
      if (data?.id) {
        setSelectedId(data.id);
      }
    },
    onError: (err) => setFeedback(err?.message || "创建失败"),
  });

  const updateAlbum = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/albums/${id}`, payload),
    onSuccess: () => {
      setFeedback("相册已更新");
      queryClient.invalidateQueries(["albums"]);
      queryClient.invalidateQueries(["home-sections"]);
    },
    onError: (err) => setFeedback(err?.message || "更新失败"),
  });

  const deleteAlbum = useMutation({
    mutationFn: (id) => api.delete(`/albums/${id}`),
    onSuccess: (_, id) => {
      setFeedback("相册已删除");
      if (selectedId === id) {
        setSelectedId(null);
      }
      queryClient.invalidateQueries(["albums"]);
      queryClient.invalidateQueries(["home-sections"]);
    },
    onError: (err) => setFeedback(err?.message || "删除失败"),
  });

  const handleCreateAlbum = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) {
      setFeedback("请输入相册名称");
      return;
    }
    createAlbum.mutate({ title: trimmed, visibility: newVisibility });
  };

  const handleRename = () => {
    if (!selectedAlbum) {
      return;
    }
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === selectedAlbum.title) {
      setIsRenaming(false);
      setTitleDraft(selectedAlbum.title);
      return;
    }
    updateAlbum.mutate({ id: selectedAlbum.id, payload: { title: trimmed } });
    setIsRenaming(false);
  };

  const handleChangeVisibility = (value) => {
    if (!selectedAlbum || value === selectedAlbum.visibility) {
      return;
    }
    updateAlbum.mutate({ id: selectedAlbum.id, payload: { visibility: value } });
  };

  const handleDelete = (albumId) => {
    if (window.confirm("确定删除该相册吗？相册内的媒体会解除绑定。")) {
      deleteAlbum.mutate(albumId);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
      <div>
        <div style={{ ...cardStyle, padding: 16, marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, marginBottom: 12 }}>新增相册</h3>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="相册名称"
            style={{ width: "100%", marginBottom: 12 }}
          />
          <select value={newVisibility} onChange={(e) => setNewVisibility(e.target.value)} style={{ width: "100%", marginBottom: 12 }}>
            <option value="private">private</option>
            <option value="unlisted">unlisted</option>
            <option value="public">public</option>
          </select>
          <button
            type="button"
            className="button-primary"
            onClick={handleCreateAlbum}
            disabled={createAlbum.isPending}
            style={{ width: "100%" }}
          >
            {createAlbum.isPending ? "创建中…" : "创建相册"}
          </button>
        </div>

        <div style={{ ...cardStyle, padding: 16, maxHeight: 480, overflowY: "auto" }}>
          <h3 style={{ fontSize: 18, marginBottom: 12 }}>相册列表</h3>
          {albumsLoading ? (
            <div>加载相册中…</div>
          ) : isError ? (
            <div style={{ color: "#dc2626" }}>{error?.message || "加载失败"}</div>
          ) : albums && albums.length > 0 ? (
            <ul style={{ display: "grid", gap: 8 }}>
              {albums.map((album) => (
                <li key={album.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(album.id)}
                    className={selectedId === album.id ? "button-primary" : "button-secondary"}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>{album.title}</span>
                    <span style={{ fontSize: 12, color: "rgba(50,44,84,0.65)" }}>
                      {album.media_count ?? 0} 媒体
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: "rgba(50,44,84,0.6)" }}>暂无相册，先创建一个吧。</div>
          )}
        </div>
      </div>

      <div style={{ ...cardStyle, padding: 24 }}>
        {feedback && <div style={{ marginBottom: 16, color: "var(--brand-ink)" }}>{feedback}</div>}

        {selectedAlbum ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              {isRenaming ? (
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={handleRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleRename();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setIsRenaming(false);
                      setTitleDraft(selectedAlbum.title);
                    }
                  }}
                  style={{ fontSize: 24, fontWeight: 700, flex: "1 1 auto" }}
                />
              ) : (
                <h3
                  style={{ fontSize: 24, fontWeight: 700, cursor: "pointer" }}
                  onDoubleClick={() => setIsRenaming(true)}
                  title="双击重命名"
                >
                  {selectedAlbum.title}
                </h3>
              )}
              <button type="button" className="button-secondary" onClick={() => handleDelete(selectedAlbum.id)}>
                删除
              </button>
            </div>

            <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
              <div style={{ fontSize: 14, color: "rgba(50,44,84,0.75)" }}>
                媒体数量：<strong>{selectedAlbum.media_count ?? 0}</strong>
              </div>
              <div style={{ fontSize: 14, color: "rgba(50,44,84,0.75)" }}>
                可见性：
                <select
                  value={selectedAlbum.visibility}
                  onChange={(e) => handleChangeVisibility(e.target.value)}
                  style={{ marginLeft: 8 }}
                >
                  <option value="private">private</option>
                  <option value="unlisted">unlisted</option>
                  <option value="public">public</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <Link to={`/albums/${selectedAlbum.id}`} className="button-secondary">
                  查看相册
                </Link>
                <Link to={`/upload?albumId=${selectedAlbum.id}`} className="button-secondary">
                  前往上传
                </Link>
              </div>
            </div>

            <div style={{ fontSize: 13, color: "rgba(50,44,84,0.6)" }}>
              提示：双击标题可以进入重命名状态；删除相册不会删除媒体，只会解除关联。
            </div>
          </div>
        ) : (
          <div style={{ color: "rgba(50,44,84,0.6)" }}>请选择左侧的相册进行管理。</div>
        )}
      </div>
    </div>
  );
}

function AccessRequestsTab() {
  const queryClient = useQueryClient();
  const { data: requests = [], isLoading, isError, error } = useAccessRequests();
  const [feedback, setFeedback] = useState("");

  const approveMutation = useMutation({
    mutationFn: ({ id, note }) => api.post(`/auth/access-requests/${id}/approve`, note ? { note } : {}),
    onSuccess: () => {
      setFeedback("申请已通过，系统已为访客生成只读账号。");
      queryClient.invalidateQueries(["access-requests"]);
      queryClient.invalidateQueries(["me"]);
    },
    onError: (err) => {
      setFeedback(err?.message || "操作失败，请稍后重试。");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }) => api.post(`/auth/access-requests/${id}/reject`, note ? { note } : {}),
    onSuccess: () => {
      setFeedback("申请已拒绝。");
      queryClient.invalidateQueries(["access-requests"]);
    },
    onError: (err) => {
      setFeedback(err?.message || "操作失败，请稍后重试。");
    },
  });

  const handleApprove = (item) => {
    if (approveMutation.isPending || rejectMutation.isPending) return;
    const confirmed = window.confirm(`确认通过「${item.username}」的访问申请吗？`);
    if (!confirmed) return;
    approveMutation.mutate({ id: item.id, note: "" });
  };

  const handleReject = (item) => {
    if (approveMutation.isPending || rejectMutation.isPending) return;
    const note = window.prompt(`填写拒绝原因（可选），将通知「${item.username}」`, "");
    rejectMutation.mutate({ id: item.id, note });
  };

  const formatDateTime = (value) => {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  };

  const pendingRequests = requests.filter((item) => item.status === "pending");
  const processedRequests = requests.filter((item) => item.status !== "pending");

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div style={{ ...cardStyle, padding: 24 }}>
        <h3 style={{ fontSize: 22, marginBottom: 6 }}>待处理申请</h3>
        <p style={{ fontSize: 13, color: "rgba(50,44,84,0.65)", marginTop: 0 }}>
          新访客提交账号申请后，会自动记录在此列表。通过后将创建只读账号，拒绝则会保留记录。
        </p>
        {feedback && (
          <div style={{ marginBottom: 16, color: "var(--brand-ink)" }}>{feedback}</div>
        )}
        {isLoading ? (
          <div>载入申请列表中…</div>
        ) : isError ? (
          <div style={{ color: "#dc2626" }}>{error?.message || "加载申请失败"}</div>
        ) : pendingRequests.length === 0 ? (
          <div style={{ color: "rgba(50,44,84,0.6)" }}>暂无待处理申请。</div>
        ) : (
          <ul style={{ display: "grid", gap: 14, margin: 0, padding: 0, listStyle: "none" }}>
            {pendingRequests.map((item) => (
              <li
                key={item.id}
                style={{
                  padding: "16px 18px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.9)",
                  border: "1px solid rgba(248,167,208,0.45)",
                  boxShadow: "var(--shadow-soft)",
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{item.username}</div>
                    <div style={{ fontSize: 12, color: "rgba(50,44,84,0.6)" }}>
                      提交时间：{formatDateTime(item.created_at)}
                    </div>
                  </div>
                </div>
                {item.message && (
                  <div
                    style={{
                      fontSize: 13,
                      color: "rgba(50,44,84,0.8)",
                      background: "rgba(248,167,208,0.12)",
                      borderRadius: 12,
                      padding: "10px 12px",
                    }}
                  >
                    {item.message}
                  </div>
                )}
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => handleApprove(item)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    style={{ flex: "1 1 auto" }}
                  >
                    {approveMutation.isPending ? "处理中…" : "通过申请"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => handleReject(item)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    style={{ flex: "1 1 auto", color: "#dc2626", borderColor: "rgba(220,38,38,0.3)" }}
                  >
                    {rejectMutation.isPending ? "处理中…" : "拒绝"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ ...cardStyle, padding: 24 }}>
        <h3 style={{ fontSize: 20, marginBottom: 12 }}>历史记录</h3>
        {processedRequests.length === 0 ? (
          <div style={{ color: "rgba(50,44,84,0.6)" }}>暂无历史记录。</div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {processedRequests.map((item) => (
              <li
                key={item.id}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(248,167,208,0.35)",
                  background: "rgba(255,255,255,0.85)",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontWeight: 600 }}>{item.username}</span>
                  <span
                    style={{
                      padding: "2px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      background:
                        item.status === "approved"
                          ? "rgba(238,255,209,0.8)"
                          : "rgba(254,226,226,0.8)",
                      color: item.status === "approved" ? "#3f6212" : "#b91c1c",
                    }}
                  >
                    {item.status === "approved" ? "已通过" : "已拒绝"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "rgba(50,44,84,0.6)" }}>
                  处理时间：{formatDateTime(item.processed_at)}
                  {item.processed_by?.username ? ` · 审核人：${item.processed_by.username}` : ""}
                </div>
                {item.decision_note && (
                  <div style={{ fontSize: 12, color: "rgba(50,44,84,0.75)" }}>备注：{item.decision_note}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AccountsTab() {
  const queryClient = useQueryClient();
  const { data: accounts = [], isLoading, isError, error } = useAccounts();
  const [feedback, setFeedback] = useState("");

  const updateRole = useMutation({
    mutationFn: ({ id, role }) => api.post(`/auth/users/${id}/role`, { role }),
    onSuccess: () => {
      setFeedback("角色已更新");
      queryClient.invalidateQueries(["accounts"]);
    },
    onError: (err) => {
      setFeedback(err?.message || "更新失败");
    },
  });

  const roleLabel = (role) => {
    if (role === "developer") return "开发者";
    if (role === "manager") return "二级管理员";
    return "访客";
  };

  return (
    <div style={{ ...cardStyle, padding: 24 }}>
      <h3 style={{ fontSize: 22, marginBottom: 6 }}>账号列表</h3>
      <p style={{ fontSize: 13, color: "rgba(50,44,84,0.65)", marginTop: 0 }}>
        显示当前系统中所有可登录账号，角色包含访客、二级管理员和开发者。
      </p>
      {feedback && <div style={{ marginBottom: 16, color: "var(--brand-ink)" }}>{feedback}</div>}
      {isLoading ? (
        <div>加载账号中…</div>
      ) : isError ? (
        <div style={{ color: "#dc2626" }}>{error?.message || "加载失败"}</div>
      ) : accounts.length === 0 ? (
        <div style={{ color: "rgba(50,44,84,0.6)" }}>暂无账号记录。</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
            <thead>
              <tr style={{ textAlign: "left", background: "rgba(248,167,208,0.15)" }}>
                <th style={{ padding: "10px 12px", fontWeight: 600 }}>用户名</th>
                <th style={{ padding: "10px 12px", fontWeight: 600 }}>角色</th>
                <th style={{ padding: "10px 12px", fontWeight: 600 }}>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const isDeveloper = account.role === "developer" || account.username === "developer";
                return (
                  <tr key={account.id} style={{ borderTop: "1px solid rgba(248,167,208,0.3)" }}>
                    <td style={{ padding: "10px 12px" }}>{account.username}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {isDeveloper ? (
                        <span>开发者（固定）</span>
                      ) : (
                        <select
                          value={account.role}
                          onChange={(e) => updateRole.mutate({ id: account.id, role: e.target.value })}
                          disabled={updateRole.isPending}
                          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(248,167,208,0.4)" }}
                        >
                          <option value="viewer">访客</option>
                          <option value="manager">二级管理员</option>
                        </select>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", color: "rgba(50,44,84,0.65)" }}>
                      {account.created_at ? new Date(account.created_at).toLocaleString() : "--"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ViewModeTab({ user }) {
  const queryClient = useQueryClient();
  const actualRole = user?.role || "viewer";
  const currentView = user?.effective_role || actualRole;
  const [selectedView, setSelectedView] = useState(currentView);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setSelectedView(currentView);
  }, [currentView]);

  const options = useMemo(() => {
    if (actualRole === "developer") {
      return [
        { value: "developer", label: "开发者视图" },
        { value: "manager", label: "二级管理员视图" },
        { value: "viewer", label: "访客视图" },
      ];
    }
    if (actualRole === "manager") {
      return [
        { value: "manager", label: "二级管理员视图" },
        { value: "viewer", label: "访客视图" },
      ];
    }
    return [];
  }, [actualRole]);

  const updateView = useMutation({
    mutationFn: (target) => {
      const payload = { view_role: target === actualRole ? null : target };
      return api.post("/auth/view-role", payload);
    },
    onSuccess: () => {
      setFeedback("视角已更新，正在返回主页…");
      queryClient.invalidateQueries(["me"]);
      window.setTimeout(() => {
        window.location.href = "/";
      }, 300);
    },
    onError: (err) => {
      setFeedback(err?.message || "视角更新失败");
    },
  });

  const handleApply = () => {
    setFeedback("");
    if (selectedView === currentView) {
      setFeedback("当前已是该视角，无需切换。");
      return;
    }
    updateView.mutate(selectedView);
  };

  return (
    <div style={{ ...cardStyle, padding: 24, maxWidth: 520 }}>
      <h3 style={{ fontSize: 22, marginBottom: 6 }}>视图控制</h3>
      <p style={{ fontSize: 13, color: "rgba(50,44,84,0.65)", marginTop: 0 }}>
        切换视角只会影响页面展示与可见功能，账号权限保持不变。切换后页面将自动刷新回到首页。
      </p>
      {options.length === 0 ? (
        <div style={{ color: "rgba(50,44,84,0.6)" }}>当前角色不支持切换视角。</div>
      ) : (
        <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>选择视角</span>
            <select
              value={selectedView}
              onChange={(event) => {
                setFeedback("");
                setSelectedView(event.target.value);
              }}
              style={{ width: 220 }}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button-primary"
            onClick={handleApply}
            disabled={updateView.isPending}
            style={{ width: 160 }}
          >
            {updateView.isPending ? "切换中…" : "保存并切换"}
          </button>
          {feedback && <div style={{ color: "var(--brand-ink)" }}>{feedback}</div>}
        </div>
      )}
    </div>
  );
}

export default function ControlCenter() {
  const navigate = useNavigate();
  const { data: user, isLoading } = useMe();
  const [params, setParams] = useSearchParams();

  const actualRole = user?.role || "viewer";
  const effectiveRole = user?.effective_role || actualRole;
  const canAccess = actualRole === "developer" || actualRole === "manager";
  const tabOrder = useMemo(() => {
    if (!canAccess) {
      return [];
    }
    if (actualRole === "developer") {
      if (effectiveRole === "developer") {
        return ["home", "albums", "requests", "accounts", "view"];
      }
      if (effectiveRole === "manager") {
        return ["home", "albums", "view"];
      }
      return ["view"];
    }
    if (actualRole === "manager") {
      if (effectiveRole === "manager") {
        return ["home", "albums", "view"];
      }
      return ["view"];
    }
    return [];
  }, [actualRole, effectiveRole, canAccess]);
  const availableTabs = tabOrder.map((id) => TAB_DEFINITIONS[id]).filter(Boolean);
  const requestedTab = params.get("tab");
  const fallbackTab = availableTabs[0]?.id ?? "home";
  const activeTab = availableTabs.some((tab) => tab.id === requestedTab) ? requestedTab : fallbackTab;

  useEffect(() => {
    if (!canAccess || availableTabs.length === 0) {
      return;
    }
    if (!requestedTab || !availableTabs.some((tab) => tab.id === requestedTab)) {
      const next = new URLSearchParams(params);
      next.set("tab", fallbackTab);
      setParams(next, { replace: true });
    }
  }, [availableTabs, canAccess, fallbackTab, params, requestedTab, setParams]);

  if (isLoading) {
    return <div>加载中…</div>;
  }

  if (!canAccess) {
    return (
      <section>
        <header className="page-header">
          <h2 className="page-title">控制中心</h2>
          <p className="page-subtitle">仅限管理员与开发者访问。</p>
        </header>
        <div style={{ color: "#dc2626", marginBottom: 16 }}>您没有访问控制中心的权限。</div>
        <button type="button" className="button-secondary" onClick={() => navigate(-1)}>
          返回
        </button>
      </section>
    );
  }

  const handleTabChange = (nextTab) => {
    if (!availableTabs.some((tab) => tab.id === nextTab)) {
      return;
    }
    const next = new URLSearchParams(params);
    next.set("tab", nextTab);
    setParams(next, { replace: true });
  };

  const subtitle =
    actualRole === "developer" && effectiveRole === "developer"
      ? "统一管理首页分类、相册内容、访客申请，以及账号视角。"
      : "管理首页分类与相册，并可调整当前账号视角。";

  return (
    <section>
      <header className="page-header">
        <h2 className="page-title">控制中心</h2>
        <p className="page-subtitle">{subtitle}</p>
      </header>

      {availableTabs.length > 0 && (
        <TabSwitcher activeTab={activeTab} onChange={handleTabChange} options={availableTabs} />
      )}

      {(() => {
        if (activeTab === "home") return <HomeTab />;
        if (activeTab === "albums") return <AlbumsTab />;
        if (activeTab === "requests") return <AccessRequestsTab />;
        if (activeTab === "accounts") return <AccountsTab />;
        return <ViewModeTab user={user} />;
      })()}
    </section>
  );
}