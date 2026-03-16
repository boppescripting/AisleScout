"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const db_1 = require("./db");
const lists_1 = __importDefault(require("./routes/lists"));
const items_1 = require("./routes/items");
const walmart_1 = __importDefault(require("./routes/walmart"));
const settings_1 = __importDefault(require("./routes/settings"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';
app.use(express_1.default.json());
app.use((0, cors_1.default)({
    origin: isProd ? false : 'http://localhost:5173',
    credentials: true,
}));
app.use('/api/lists', lists_1.default);
app.use('/api/lists/:listId/items', items_1.listItemsRouter);
app.use('/api/items', items_1.itemsRouter);
app.use('/api/walmart', walmart_1.default);
app.use('/api/settings', settings_1.default);
if (isProd) {
    const frontendPath = path_1.default.join(__dirname, '../frontend');
    app.use(express_1.default.static(frontendPath));
    app.get('*', (_req, res) => {
        res.sendFile(path_1.default.join(frontendPath, 'index.html'));
    });
}
(0, db_1.initDb)().then(() => {
    app.listen(PORT, () => console.log(`AisleScout running on :${PORT}`));
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
