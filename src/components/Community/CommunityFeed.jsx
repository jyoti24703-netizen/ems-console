import React, { useState, useEffect, useContext, useMemo } from "react";
import { AuthContext } from "../../context/AuthProvider";
import PollCreator from "./PollCreator";

const API_ORIGIN = "http://localhost:4000";

const CommunityFeed = () => {
  const { user } = useContext(AuthContext);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showComments, setShowComments] = useState({});
  const [commentText, setCommentText] = useState({});
  const [feedFilter, setFeedFilter] = useState("all");
  const [feedSearch, setFeedSearch] = useState("");
  const [feedSort, setFeedSort] = useState("recent");
  const [onlyMentions, setOnlyMentions] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusImages, setStatusImages] = useState([]);
  const [statusImagePreviews, setStatusImagePreviews] = useState([]);
  const [expandedPosts, setExpandedPosts] = useState({});
  const [showStatusComposer, setShowStatusComposer] = useState(false);
  const [mentionUsers, setMentionUsers] = useState([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionAnchor, setMentionAnchor] = useState(null);
  const [activeStatus, setActiveStatus] = useState(null);
  const statusInputRef = React.useRef(null);
  const postInputRef = React.useRef(null);
  
  const [newPost, setNewPost] = useState({
    title: "",
    content: "",
    postType: "discussion", // announcement, discussion, poll, celebration, help
    images: [],
    poll: null
  });

  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState([]);

  const toAbsoluteAssetUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return `${API_ORIGIN}${url}`;
    return `${API_ORIGIN}/${url.replace(/^\/+/, "")}`;
  };

  const getEntityId = (entity) => {
    if (!entity) return "";
    if (typeof entity === "string") return entity;
    return entity._id || entity.id || "";
  };

  const isAdmin = user?.role === "admin";
  const announcementPosts = useMemo(() => {
    return posts.filter((post) => (post.postType || post.type) === "announcement");
  }, [posts]);

  const communityPosts = useMemo(() => {
    return posts.filter((post) => !["announcement", "status"].includes(post.postType || post.type));
  }, [posts]);

  const statusPosts = useMemo(() => {
    const cut = Date.now() - 24 * 60 * 60 * 1000;
    return posts
      .filter((post) => (post.postType || post.type) === "status")
      .filter((post) => new Date(post.createdAt || 0).getTime() >= cut)
      .slice(0, 8);
  }, [posts]);

  const filteredCommunityPosts = useMemo(() => {
    let list = communityPosts;

    if (feedFilter !== "all") {
      if (feedFilter === "announcement") {
        list = announcementPosts;
      } else {
        list = communityPosts.filter((post) => (post.postType || post.type) === feedFilter);
      }
    }

    if (onlyMentions) {
      list = list.filter((post) =>
        (post.mentions || []).some((m) => m?._id === user?.id || m?.id === user?.id)
      );
    }

    const q = feedSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((post) =>
        (post.title || "").toLowerCase().includes(q) ||
        (post.content || "").toLowerCase().includes(q) ||
        (post.author?.name || "").toLowerCase().includes(q) ||
        (post.postType || post.type || "").toLowerCase().includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      if (feedSort === "most_liked") {
        return (b.likes?.length || 0) - (a.likes?.length || 0);
      }
      if (feedSort === "most_commented") {
        return (b.comments?.length || 0) - (a.comments?.length || 0);
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    return list;
  }, [communityPosts, announcementPosts, feedFilter, onlyMentions, feedSearch, feedSort, user?.id]);

  const feedCounts = useMemo(() => ({
    all: communityPosts.length,
    discussion: communityPosts.filter((p) => (p.postType || p.type) === "discussion").length,
    poll: communityPosts.filter((p) => (p.postType || p.type) === "poll").length,
    celebration: communityPosts.filter((p) => (p.postType || p.type) === "celebration").length,
    help: communityPosts.filter((p) => (p.postType || p.type) === "help").length,
    announcement: announcementPosts.length,
    idea: communityPosts.filter((p) => (p.postType || p.type) === "idea").length,
  }), [communityPosts, announcementPosts]);

  // Fetch community posts
  const fetchPosts = async () => {
    if (!user?.token) {
      setPosts([]);
      setLoading(false);
      return;
    }
    try {
      const ts = Date.now();
      const res = await fetch(`http://localhost:4000/api/community/feed?ts=${ts}`, {
        headers: { Authorization: `Bearer ${user.token}` },
        cache: "no-store"
      });
      const data = await res.json();
      if (data.success) {
        const nextPosts = data.posts || [];
        setPosts(nextPosts);
        if (activeStatus?._id) {
          const refreshedStatus = nextPosts.find((p) => p._id === activeStatus._id);
          setActiveStatus(refreshedStatus || null);
        }
      }
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPosts([]);
    setActiveStatus(null);
    setLoading(true);
    fetchPosts();
  }, [user?.id, user?.token]);
  
  

  const fetchMentionUsers = async () => {
    if (!user?.token) {
      setMentionUsers([]);
      return;
    }
    try {
      const ts = Date.now();
      const res = await fetch(`http://localhost:4000/api/community/users?ts=${ts}`, {
        headers: { Authorization: `Bearer ${user.token}` },
        cache: "no-store"
      });
      const data = await res.json();
      if (data.success) {
        setMentionUsers(data.users || []);
      }
    } catch (_err) {
      setMentionUsers([]);
    }
  };

  useEffect(() => {
    fetchMentionUsers();
  }, [user?.id, user?.token]);

  // Handle image selection
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + selectedImages.length > 5) {
      alert("Maximum 5 images allowed per post");
      return;
    }

    setSelectedImages([...selectedImages, ...files]);

    // Create preview URLs
    const newPreviewUrls = files.map(file => URL.createObjectURL(file));
    setImagePreviewUrls([...imagePreviewUrls, ...newPreviewUrls]);
  };

  // Remove image from selection
  const removeImage = (index) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    const newPreviews = imagePreviewUrls.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    setImagePreviewUrls(newPreviews);
  };

  const handleStatusImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + statusImages.length > 3) {
      alert("Maximum 3 images allowed for status updates");
      return;
    }
    setStatusImages([...statusImages, ...files]);
    const newPreviewUrls = files.map(file => URL.createObjectURL(file));
    setStatusImagePreviews([...statusImagePreviews, ...newPreviewUrls]);
  };

  const removeStatusImage = (index) => {
    const newImages = statusImages.filter((_, i) => i !== index);
    const newPreviews = statusImagePreviews.filter((_, i) => i !== index);
    setStatusImages(newImages);
    setStatusImagePreviews(newPreviews);
  };

  // Handle poll creation
  const handlePollCreated = (pollData) => {
    setNewPost({ ...newPost, poll: pollData, postType: "poll" });
  };

  const handleSharePost = async (post) => {
    const link = `${window.location.origin}/community/post/${post._id}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        alert("Link copied to clipboard");
      } else {
        alert(`Copy this link: ${link}`);
      }
    } catch (err) {
      alert(`Copy this link: ${link}`);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      const res = await fetch(`http://localhost:4000/api/community/post/${postId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete post");
      }
      fetchPosts();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCreateStatus = async () => {
    const text = statusText.trim();
    if (!text && statusImages.length === 0) return;
    try {
      setStatusSubmitting(true);
      const formData = new FormData();
      formData.append("title", "Status Update");
      formData.append("content", text);
      formData.append("postType", "status");
      statusImages.forEach((image) => {
        formData.append("images", image);
      });

      const res = await fetch("http://localhost:4000/api/community/post", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create status");

      setStatusText("");
      setStatusImages([]);
      setStatusImagePreviews([]);
      fetchPosts();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Create new post
  const handleCreatePost = async () => {
    try {
      if (!newPost.title || (!newPost.content && selectedImages.length === 0 && !newPost.poll)) {
        alert("Title and content/images/poll are required");
        return;
      }

      const formData = new FormData();
      formData.append("title", newPost.title);
      formData.append("content", newPost.content);
      formData.append("postType", newPost.postType);
      
      // Add images
      selectedImages.forEach((image) => {
        formData.append("images", image);
      });

      // Add poll data if exists
      if (newPost.poll) {
        formData.append("pollQuestion", newPost.poll.question);
        formData.append(
          "pollOptions",
          JSON.stringify(newPost.poll.options.map((opt) => opt.text))
        );
        if (newPost.poll.expiresAt) {
          formData.append("pollEndDate", newPost.poll.expiresAt);
        }
      }

      const res = await fetch("http://localhost:4000/api/community/post", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        body: formData,
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to create post");

      alert(" Post created successfully!");
      setShowCreatePost(false);
      setNewPost({ title: "", content: "", postType: "discussion", images: [], poll: null });
      setSelectedImages([]);
      setImagePreviewUrls([]);
      fetchPosts();
    } catch (err) {
      alert(` Error: ${err.message}`);
    }
  };

  // Like post
  const handleLikePost = async (postId) => {
    try {
      const res = await fetch(`http://localhost:4000/api/community/post/${postId}/like`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (res.ok) {
        fetchPosts(); // Refresh to get updated likes
      }
    } catch (err) {
      console.error("Failed to like post:", err);
    }
  };

  // Add comment
  const handleAddComment = async (postId) => {
    const text = commentText[postId];
    if (!text || text.trim().length === 0) return;

    try {
      const res = await fetch(`http://localhost:4000/api/community/post/${postId}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ content: text.trim() }),
      });

      if (res.ok) {
        setCommentText({ ...commentText, [postId]: "" });
        fetchPosts(); // Refresh to get updated comments
      }
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  };

  // Vote on poll
  const handleVote = async (postId, optionIndex) => {
    try {
      const res = await fetch(`http://localhost:4000/api/community/post/${postId}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ optionIndex }),
      });

      if (res.ok) {
        fetchPosts(); // Refresh to get updated votes
      }
    } catch (err) {
      console.error("Failed to vote:", err);
    }
  };

  const formatDate = (date) => {
    const now = new Date();
    const postDate = new Date(date);
    const diffMs = now - postDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return postDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: postDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const renderWithMentions = (text) => {
    if (!text) return text;
    const parts = text.split(/(@[a-zA-Z0-9_.-]+)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("@")) {
        return (
          <span key={`mention-${idx}`} className="text-blue-300 font-semibold">
            {part}
          </span>
        );
      }
      return <span key={`text-${idx}`}>{part}</span>;
    });
  };

  const handleStatusChange = (value) => {
    setStatusText(value);
    const match = value.match(/@([a-zA-Z0-9_.-]{0,20})$/);
    if (match) {
      setMentionQuery(match[1] || "");
      setMentionAnchor("status");
    } else {
      setMentionQuery("");
      setMentionAnchor(null);
    }
  };

  const insertMention = (name, anchor = "status") => {
    const value = anchor === "status" ? statusText : newPost.content;
    const newValue = value.replace(/@([a-zA-Z0-9_.-]{0,20})$/, `@${name} `);
    if (anchor === "status") {
      setStatusText(newValue);
    } else {
      setNewPost((prev) => ({ ...prev, content: newValue }));
    }
    setMentionQuery("");
    setMentionAnchor(null);
    if (anchor === "status" && statusInputRef.current) statusInputRef.current.focus();
    if (anchor === "post" && postInputRef.current) postInputRef.current.focus();
  };

  const handlePostContentChange = (value) => {
    setNewPost((prev) => ({ ...prev, content: value }));
    const match = value.match(/@([a-zA-Z0-9_.-]{0,20})$/);
    if (match) {
      setMentionQuery(match[1] || "");
      setMentionAnchor("post");
    } else if (mentionAnchor === "post") {
      setMentionQuery("");
      setMentionAnchor(null);
    }
  };

  const getPostIcon = (type) => {
    const icons = {
      announcement: "ANN",
      discussion: "CHAT",
      poll: "POLL",
      celebration: "WIN",
      help: "HELP",
      idea: "IDEA",
      status: "STAT"
    };
    return icons[type] || "POST";
  };

  const toggleComments = (postId) => {
    setShowComments({ ...showComments, [postId]: !showComments[postId] });
    setExpandedPosts((prev) => ({ ...prev, [postId]: true }));
  };

  const toggleExpanded = (postId) => {
    setExpandedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const getLikeNames = (post) => {
    if (!post?.likes) return [];
    return post.likes
      .map((like) => like?.name || like?.email || like?.toString())
      .filter(Boolean);
  };

  const getCommenterNames = (post) => {
    if (!post?.comments) return [];
    const names = post.comments
      .map((comment) => comment?.author?.name || comment?.authorName || comment?.author?.email)
      .filter(Boolean);
    return Array.from(new Set(names));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Community Feed</h2>
          <p className="text-sm text-gray-400">Share updates, celebrate wins, and engage with your team</p>
        </div>
        <button
          onClick={() => setShowCreatePost(true)}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded flex items-center gap-2"
        >
          <span className="text-xl">+</span> Create Post
        </button>
      </div>

      <div className="bg-[#1f2933] border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Status Updates</div>
            <div className="text-xs text-gray-400">Quick updates that expire in 24 hours</div>
          </div>
          <button
            onClick={() => setShowStatusComposer((prev) => !prev)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-xs hover:border-gray-500"
          >
            {showStatusComposer ? "Close" : "Create Status"}
          </button>
        </div>
        {showStatusComposer && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2 relative">
              <input
                ref={statusInputRef}
                className="flex-1 min-w-[220px] p-2 bg-[#0f172a] border border-gray-700 rounded text-sm"
                placeholder="Share a short update... use @name to tag"
                value={statusText}
                onChange={(e) => handleStatusChange(e.target.value)}
              />
              <label className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-xs cursor-pointer hover:border-gray-500">
                Add Photo
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleStatusImageSelect}
                  className="hidden"
                />
              </label>
              <button
                onClick={handleCreateStatus}
                disabled={statusSubmitting || (!statusText.trim() && statusImages.length === 0)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-60"
              >
                {statusSubmitting ? "Posting..." : "Post Status"}
              </button>
              {mentionAnchor === "status" && mentionUsers.length > 0 && (
                <div className="absolute mt-12 left-0 bg-[#0b1220] border border-gray-700 rounded shadow-lg z-20 w-64 max-h-52 overflow-y-auto">
                  {mentionUsers
                    .filter(u => {
                      const q = mentionQuery.toLowerCase();
                      return !q || (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
                    })
                    .slice(0, 6)
                    .map(u => (
                      <button
                        key={u._id}
                        onClick={() => insertMention(u.name || u.email, "status")}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-800"
                      >
                        <div className="text-white">{u.name || u.email}</div>
                        <div className="text-xs text-gray-400">{u.email}</div>
                      </button>
                    ))}
                </div>
              )}
            </div>
            {statusImagePreviews.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {statusImagePreviews.map((url, idx) => (
                  <div key={idx} className="relative">
                    <img src={url} alt={`Status ${idx + 1}`} className="w-16 h-16 object-cover rounded" />
                    <button
                      onClick={() => removeStatusImage(idx)}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Strip */}
      <div className="bg-[#0f172a] border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-semibold">Status Updates</h4>
            <p className="text-xs text-gray-400">Short highlights from your team in the last 24h</p>
          </div>
          <div className="text-xs text-gray-500">WhatsApp-style highlights</div>
        </div>
        {loading ? (
          <div className="text-sm text-gray-400">Loading status updates...</div>
        ) : statusPosts.length === 0 ? (
          <div className="text-sm text-gray-500">No status updates yet.</div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {statusPosts.map((post) => (
              <div
                key={`status-${post._id}`}
                className="min-w-[180px] bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-pointer hover:border-blue-500"
                onClick={() => setActiveStatus(post)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">
                    {post.author?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{post.author?.name || "Team"}</div>
                    <div className="text-xs text-gray-400">{formatDate(post.createdAt)}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-300 line-clamp-3">
                  {post.title || post.content || "New update"}
                </div>
                {post.images && post.images.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-10 h-10 rounded bg-gray-700 overflow-hidden">
                      <img src={toAbsoluteAssetUrl(post.images[0].url)} alt="Status" className="w-full h-full object-cover" />
                    </div>
                    <span>{post.images.length} photo{post.images.length !== 1 ? "s" : ""}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-blue-400 text-xs font-semibold">GUIDELINES</span>
          <div>
            <h4 className="font-semibold">Community Standards</h4>
            <p className="text-sm text-gray-300">
              Use this space for operational updates, questions, and collaboration. Keep language professional, avoid confidential data, and tag teammates only when action is needed.
            </p>
          </div>
        </div>
      </div>

      {/* Admin Announcements */}
      <div className="bg-[#1f2933] border border-gray-700 rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Admin Announcements</h3>
            <p className="text-sm text-gray-400">Pinned, company-safe updates from leadership</p>
          </div>
          <span className="text-xs text-gray-400">{announcementPosts.length} items</span>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="text-sm text-gray-400">Loading announcements...</div>
          ) : announcementPosts.length === 0 ? (
            <div className="text-sm text-gray-500">No announcements yet.</div>
          ) : (
            announcementPosts.map((post) => {
              const canDelete =
                post.author?._id === user.id ||
                post.author?.id === user.id;
              return (
              <div key={post._id} className="bg-[#0b1220] border-l-4 border-blue-600 rounded-lg p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold bg-blue-700/40 text-blue-200 px-2 py-1 rounded">NOTICE</span>
                    <div className="font-semibold text-white">{post.title}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-400">{formatDate(post.createdAt)}</div>
                    {canDelete && (
                      <button
                        onClick={() => handleDeletePost(post._id)}
                        className="text-xs text-red-300 hover:text-red-200"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  Sent by {post.author?.name || "Admin"}
                </div>
                {post.content && (
                  <p className="text-sm text-gray-300 mt-3 whitespace-pre-wrap">{post.content}</p>
                )}
                {post.images && post.images.length > 0 && (
                  <div className={`mt-3 grid gap-2 ${
                    post.images.length === 1 ? "grid-cols-1" : post.images.length === 2 ? "grid-cols-2" : "grid-cols-3"
                  }`}>
                    {post.images.map((image, idx) => (
                      <img
                        key={idx}
                        src={toAbsoluteAssetUrl(image.url)}
                        alt={`Announcement image ${idx + 1}`}
                        className="w-full h-40 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                )}
                <div className="mt-3 text-xs text-gray-500">Comments disabled for announcements.</div>
              </div>
            );
            })
          )}
        </div>
      </div>

      {/* Community Feed */}
      <div className="flex items-center justify-between bg-[#1f2933] border border-gray-700 rounded-lg p-4">
        <div>
          <h3 className="text-xl font-semibold">Community Feed</h3>
          <p className="text-sm text-gray-400">Structured collaboration across discussion, polls, celebrations, and help requests</p>
        </div>
        <div className="text-xs text-gray-400">Use @name to tag teammates</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          value={feedSearch}
          onChange={(e) => setFeedSearch(e.target.value)}
          placeholder="Search by title, content, author, type..."
          className="md:col-span-2 p-2.5 bg-[#0f172a] border border-gray-700 rounded text-sm"
        />
        <select
          value={feedSort}
          onChange={(e) => setFeedSort(e.target.value)}
          className="p-2.5 bg-[#0f172a] border border-gray-700 rounded text-sm"
        >
          <option value="recent">Most Recent</option>
          <option value="most_liked">Most Liked</option>
          <option value="most_commented">Most Commented</option>
        </select>
        <button
          onClick={() => setOnlyMentions((v) => !v)}
          className={`p-2.5 rounded text-sm border ${
            onlyMentions
              ? "bg-blue-600 border-blue-500 text-white"
              : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500"
          }`}
        >
          {onlyMentions ? "Mentioned to Me: ON" : "Mentioned to Me: OFF"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["all", "All"],
          ["discussion", "Discussion"],
          ["poll", "Poll"],
          ["celebration", "Celebration"],
          ["help", "Help"],
          ["announcement", "Announcement"],
          ["idea", "Idea"]
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFeedFilter(key)}
            className={`text-xs px-3 py-2 rounded border ${
              feedFilter === key
                ? "bg-blue-600 text-white border-blue-500"
                : "bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-500"
            }`}
          >
            {label} ({feedCounts[key] || 0})
          </button>
        ))}
      </div>

      {/* Posts Feed */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading community feed...</div>
      ) : filteredCommunityPosts.length === 0 ? (
        <div className="bg-gray-800 p-12 rounded-lg text-center">
          <span className="text-6xl">POST</span>
          <h3 className="text-xl font-semibold mt-4">No Matching Posts</h3>
          <p className="text-gray-400 mt-2">
            Try changing search/filter settings or create a new post.
          </p>
          <button
            onClick={() => setShowCreatePost(true)}
            className="mt-4 bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded"
          >
            Create First Post
          </button>
        </div>
        ) : (
          <div className="space-y-4">
            {filteredCommunityPosts.map((post) => {
              const postType = post.postType || post.type;
              const canDelete =
                post.author?._id === user.id ||
                post.author?.id === user.id;
              const isExpanded = !!expandedPosts[post._id];
              const likeNames = getLikeNames(post);
              const commenterNames = getCommenterNames(post);
              const mentionNames = (post.mentions || []).map(m => m?.name || m?.email).filter(Boolean);
              const isMentioned = (post.mentions || []).some(m => m?._id === user?.id || m?.id === user?.id);
              return (
                <div key={post._id} className="bg-[#1f2933] border border-gray-700 rounded-lg hover:border-blue-700/50 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  {/* Post Header */}
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Author Avatar */}
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                          {post.author?.name?.charAt(0)?.toUpperCase() || "A"}
                        </div>
                      </div>
  
                      {/* Post Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{post.author?.name || "Admin"}</span>
                            <span className="text-gray-400 text-sm">{formatDate(post.createdAt)}</span>
                            <span className="text-xl">{getPostIcon(postType)}</span>
                            {postType && (
                              <span className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-300">
                                {postType}
                              </span>
                            )}
                            {isMentioned && (
                              <span className="text-xs px-2 py-1 bg-blue-900/30 text-blue-200 rounded">
                                You were mentioned
                              </span>
                            )}
                          </div>
                          {canDelete && (
                            <button
                              onClick={() => handleDeletePost(post._id)}
                              className="text-xs text-red-300 hover:text-red-200"
                            >
                              Delete
                            </button>
                          )}
                          <button
                            onClick={() => toggleExpanded(post._id)}
                            className="text-xs text-blue-300 hover:text-blue-200"
                          >
                            {isExpanded ? "Collapse" : "Open"}
                          </button>
                        </div>
  
                        <h3 className="text-lg font-semibold text-white mb-2">{post.title}</h3>
                        {mentionNames.length > 0 && (
                          <div className="text-xs text-blue-300 mb-2">
                            Tagged: {mentionNames.map(n => `@${n}`).join(", ")}
                          </div>
                        )}
                        {post.content && (
                          <p className={`text-gray-300 whitespace-pre-wrap ${isExpanded ? "" : "line-clamp-2"}`}>
                            {renderWithMentions(post.content)}
                          </p>
                        )}
                        {!isExpanded && (
                          <button
                            onClick={() => toggleExpanded(post._id)}
                            className="mt-2 text-xs text-blue-300 hover:text-blue-200"
                          >
                            View details
                          </button>
                        )}
  
                        {/* Images */}
                        {isExpanded && post.images && post.images.length > 0 && (
                          <div className={`mt-4 grid gap-2 ${
                            post.images.length === 1 ? 'grid-cols-1' :
                            post.images.length === 2 ? 'grid-cols-2' :
                            'grid-cols-3'
                          }`}>
                            {post.images.map((image, idx) => (
                              <img
                                key={idx}
                                src={toAbsoluteAssetUrl(image.url)}
                                alt={`Post image ${idx + 1}`}
                                className="w-full h-64 object-cover rounded-lg cursor-pointer hover:opacity-90"
                                onClick={() => window.open(toAbsoluteAssetUrl(image.url), '_blank')}
                              />
                            ))}
                          </div>
                        )}
  
                        {/* Poll */}
                        {isExpanded && postType === "poll" && post.pollQuestion && post.pollOptions && (
                          <div className="mt-4 p-4 bg-gradient-to-br from-blue-900/40 via-indigo-900/30 to-emerald-900/20 border border-blue-700/40 rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold">Poll</h4>
                              <span className="text-xs text-blue-200">{post.pollOptions.length} options</span>
                            </div>
                            <div className="text-sm text-gray-200 mb-3">{post.pollQuestion}</div>
                            <div className="space-y-2">
                          {post.pollOptions.map((option, idx) => {
                            const totalVotes = post.pollOptions.reduce((sum, opt) => sum + (opt.votes || 0), 0);
                            const percentage = totalVotes > 0 ? Math.round((option.votes || 0) / totalVotes * 100) : 0;
                            const hasVoted = option.voters?.some(v => getEntityId(v) === user.id);
                            const userHasVoted = post.pollOptions.some(opt => opt.voters?.some(v => getEntityId(v) === user.id));
  
                            return (
                              <button
                                key={idx}
                                onClick={() => !userHasVoted && handleVote(post._id, idx)}
                                disabled={userHasVoted}
                                className={`w-full text-left p-3 rounded transition border ${
                                  hasVoted ? 'bg-gradient-to-r from-blue-600 to-emerald-500 text-white border-blue-400' :
                                  userHasVoted ? 'bg-gray-700/70 cursor-not-allowed border-gray-600' :
                                  'bg-[#0f172a] hover:bg-gray-700 border-gray-700'
                                }`}
                              >
                                <div className="flex justify-between items-center mb-1 gap-3">
                                  <span className="font-medium text-sm truncate">{option.text}</span>
                                  <span className="text-xs px-2 py-0.5 rounded bg-black/20">{percentage}%</span>
                                </div>
                                <div className="h-2 bg-gray-900 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${hasVoted ? 'bg-emerald-300' : 'bg-blue-400/60'}`}
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                                <div className="text-xs text-gray-300 mt-1">
                                  {option.votes || 0} vote{option.votes !== 1 ? 's' : ''}
                                </div>
                                {option.voters && option.voters.length > 0 && (
                                  <div className="text-xs text-gray-300 mt-2">
                                    Voted by: {option.voters.map(v => v.name || v.email || v.toString()).join(", ")}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                            </div>
                            {post.pollOptions.some(opt => opt.voters?.some(v => getEntityId(v) === user.id)) && (
                              <div className="text-xs text-gray-400 mt-2">You voted on this poll</div>
                            )}
                          </div>
                        )}
  
                        {postType !== "announcement" && (
                          <>
                            {/* Engagement */}
                            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-700 text-sm">
                              <button
                                onClick={() => handleLikePost(post._id)}
                                className={`flex items-center gap-2 ${
                                  post.likes?.some((like) => getEntityId(like) === user.id)
                                    ? 'text-blue-400'
                                    : 'text-gray-400 hover:text-blue-400'
                                }`}
                              >
                                <span className="text-xs font-semibold">LIKE</span>
                                {post.likes?.length || 0}
                              </button>
    
                              <button
                                onClick={() => toggleComments(post._id)}
                                className="flex items-center gap-2 text-gray-400 hover:text-blue-400"
                              >
                                <span className="text-xs font-semibold">COMMENT</span>
                                {post.comments?.length || 0}
                              </button>
    
                              <button
                                onClick={() => handleSharePost(post)}
                                className="flex items-center gap-2 text-gray-400 hover:text-blue-400"
                              >
                                <span className="text-xs font-semibold">SHARE</span>
                              </button>
                            </div>
                            {(likeNames.length > 0 || commenterNames.length > 0) && (
                              <div className="mt-2 text-xs text-gray-400">
                                {likeNames.length > 0 && (
                                  <span>
                                    Liked by {likeNames.slice(0, 3).join(", ")}
                                    {likeNames.length > 3 ? ` +${likeNames.length - 3} more` : ""}
                                  </span>
                                )}
                                {likeNames.length > 0 && commenterNames.length > 0 && <span> • </span>}
                                {commenterNames.length > 0 && (
                                  <span>
                                    Replied by {commenterNames.slice(0, 3).join(", ")}
                                    {commenterNames.length > 3 ? ` +${commenterNames.length - 3} more` : ""}
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        )}
  
                        {/* Comments Section */}
                        {isExpanded && showComments[post._id] && (
                          <div className="mt-4 pt-4 border-t border-gray-700">
                            {/* Add Comment */}
                            <div className="flex gap-2 mb-4">
                              <input
                                type="text"
                                placeholder="Write a comment..."
                                className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                                value={commentText[post._id] || ""}
                                onChange={(e) => setCommentText({ ...commentText, [post._id]: e.target.value })}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post._id)}
                              />
                              <button
                                onClick={() => handleAddComment(post._id)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                              >
                                Post
                              </button>
                            </div>
  
                            {/* Comments List */}
                            <div className="space-y-3">
                              {post.comments?.map((comment, idx) => (
                                <div key={idx} className="flex gap-3">
                                  <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0">
                                    {comment.author?.name?.charAt(0)?.toUpperCase() || "U"}
                                  </div>
                                  <div className="flex-1 bg-gray-700 p-3 rounded-lg">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-sm">{comment.author?.name || "User"}</span>
                                      <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
                                    </div>
                                    <p className="text-sm text-gray-300">
                                      {renderWithMentions(comment.content)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Create New Post</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-2">Post Type</label>
                <select
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                  value={newPost.postType}
                  onChange={(e) => setNewPost({ ...newPost, postType: e.target.value })}
                >
                  {user?.role === "admin" && <option value="announcement">Announcement</option>}
                  <option value="discussion">Discussion</option>
                  <option value="poll">Poll</option>
                  <option value="celebration">Celebration</option>
                  <option value="help">Help/Question</option>
                  <option value="idea">Idea</option>
                </select>
              </div>

              <input
                type="text"
                placeholder="Post Title *"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                value={newPost.title}
                onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
              />

              <textarea
                placeholder="What do you want to share with your team?"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                rows="4"
                value={newPost.content}
                onChange={(e) => handlePostContentChange(e.target.value)}
                ref={postInputRef}
              />
              {mentionAnchor === "post" && mentionUsers.length > 0 && (
                <div className="bg-[#0b1220] border border-gray-700 rounded shadow-lg z-20 w-full max-h-52 overflow-y-auto">
                  {mentionUsers
                    .filter(u => {
                      const q = mentionQuery.toLowerCase();
                      return !q || (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
                    })
                    .slice(0, 6)
                    .map(u => (
                      <button
                        key={`post-mention-${u._id}`}
                        onClick={() => insertMention(u.name || u.email, "post")}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-800"
                      >
                        <div className="text-white">{u.name || u.email}</div>
                        <div className="text-xs text-gray-400">{u.email}</div>
                      </button>
                    ))}
                </div>
              )}
              <div className="text-xs text-gray-500">
                Tip: Use @name to tag teammates in your post.
              </div>

              {/* Image Upload */}
              <div>
                <label className="text-sm text-gray-400 block mb-2">
                  Add Images (Max 5)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
                />
                
                {/* Image Previews */}
                {imagePreviewUrls.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {imagePreviewUrls.map((url, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={url}
                          alt={`Preview ${idx + 1}`}
                          className="w-full h-32 object-cover rounded"
                        />
                        <button
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-700"
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Poll Creator */}
              {newPost.postType === "poll" && (
                <PollCreator onPollCreated={handlePollCreated} />
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreatePost}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded font-medium"
                >
                  Publish Post
                </button>
                <button
                  onClick={() => {
                    setShowCreatePost(false);
                    setSelectedImages([]);
                    setImagePreviewUrls([]);
                  }}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {activeStatus && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0b1220] border border-gray-700 rounded-lg p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white">
                  {activeStatus.author?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div>
                  <div className="font-semibold">{activeStatus.author?.name || "Team"}</div>
                  <div className="text-xs text-gray-400">{formatDate(activeStatus.createdAt)}</div>
                </div>
              </div>
              <button
                onClick={() => setActiveStatus(null)}
                className="text-sm text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>
            {activeStatus.content && (
              <div className="text-sm text-gray-200 whitespace-pre-wrap">
                {renderWithMentions(activeStatus.content)}
              </div>
            )}
            {activeStatus.mentions && activeStatus.mentions.length > 0 && (
              <div className="mt-2 text-xs text-blue-300">
                Tagged: {activeStatus.mentions.map(m => `@${m?.name || m?.email}`).join(", ")}
              </div>
            )}
            {activeStatus.images && activeStatus.images.length > 0 && (
              <div className={`mt-4 grid gap-2 ${
                activeStatus.images.length === 1 ? "grid-cols-1" :
                activeStatus.images.length === 2 ? "grid-cols-2" :
                "grid-cols-3"
              }`}>
                {activeStatus.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={toAbsoluteAssetUrl(img.url)}
                    alt={`Status ${idx + 1}`}
                    className="w-full h-48 object-cover rounded"
                  />
                ))}
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-gray-700 space-y-3">
              <div className="flex items-center gap-5 text-sm">
                <button
                  onClick={() => handleLikePost(activeStatus._id)}
                  className={`${
                    activeStatus.likes?.some((like) => getEntityId(like) === user.id)
                      ? "text-blue-400"
                      : "text-gray-300 hover:text-blue-300"
                  }`}
                >
                  LIKE ({activeStatus.likes?.length || 0})
                </button>
                <button
                  onClick={() => handleSharePost(activeStatus)}
                  className="text-gray-300 hover:text-blue-300"
                >
                  SHARE
                </button>
                {(activeStatus.author?._id === user.id || activeStatus.author?.id === user.id) && (
                  <button
                    onClick={async () => {
                      await handleDeletePost(activeStatus._id);
                      setActiveStatus(null);
                    }}
                    className="text-red-300 hover:text-red-200"
                  >
                    DELETE
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Write a comment..."
                  className="flex-1 p-2 bg-gray-900 border border-gray-700 rounded text-sm"
                  value={commentText[activeStatus._id] || ""}
                  onChange={(e) => setCommentText({ ...commentText, [activeStatus._id]: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && handleAddComment(activeStatus._id)}
                />
                <button
                  onClick={() => handleAddComment(activeStatus._id)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                >
                  Comment
                </button>
              </div>
              {(activeStatus.comments || []).length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {(activeStatus.comments || []).map((comment, idx) => (
                    <div key={`status-comment-${idx}`} className="bg-gray-900 border border-gray-700 rounded p-2">
                      <div className="text-xs text-gray-400 mb-1">
                        {comment.author?.name || comment.authorName || "User"} • {formatDate(comment.createdAt)}
                      </div>
                      <div className="text-sm text-gray-200">{renderWithMentions(comment.content)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityFeed;








