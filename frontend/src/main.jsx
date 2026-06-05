import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./styles/theme.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import Login from "./pages/Login";
import Gallery from "./pages/Gallery";
import Upload from "./pages/Upload";
import Albums from "./pages/Albums";
import AlbumDetail from "./pages/AlbumDetail";
import MediaDetail from "./pages/MediaDetail";
import SocialFeed from "./pages/SocialFeed";
import SocialPostDetail from "./pages/SocialPostDetail";
import CategoryCollection from "./pages/CategoryCollection";
import ControlCenter from "./pages/ControlCenter";
import SearchResults from "./pages/SearchResults";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Gallery /> },
      { path: "albums", element: <Albums /> },
      { path: "albums/:id", element: <AlbumDetail /> },
      { path: "media/:id", element: <MediaDetail /> },
      { path: "upload", element: <Upload /> },
      { path: "social", element: <SocialFeed /> },
      { path: "social/:id", element: <SocialPostDetail /> },
      { path: "collections/:key", element: <CategoryCollection /> },
      { path: "search", element: <SearchResults /> },
      { path: "control", element: <ControlCenter /> },
    ],
  },
]);

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);