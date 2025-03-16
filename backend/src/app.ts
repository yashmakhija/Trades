import balanceRoutes from "./routes/balanceRoutes";

// Register routes
app.use("/api/auth", authRoutes);
app.use("/api/symbols", symbolRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/candles", candleRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/balance", balanceRoutes);
