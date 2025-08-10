# Argos - Global Military Conflicts & Arms Trade Platform

A comprehensive web application that centralizes and displays live, factual data on global military conflicts and arms trades.

## 🎯 Features

### 🗺️ Interactive Conflict Map
- Real-time visualization of global military conflicts
- Mapbox integration with custom markers
- Conflict details on click (location, type, status, casualties)
- Color-coded markers by conflict status (Active, Ceasefire, Resolved)

### 📊 Arms Trade Database
- Comprehensive arms deals tracking
- Advanced filtering by country, status, date, and value
- Sortable table with detailed deal information
- Export functionality for analysis

### 📰 Conflict News Feed
- Curated conflict-related news
- Regional filtering and search
- Source tracking and verification
- Tag-based categorization

### 🔐 Admin Panel
- CRUD operations for all data types
- Simple authentication system
- Real-time data management
- Bulk import capabilities

## 🛠️ Technology Stack

- **Frontend**: Next.js 14 with App Router, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Maps**: Mapbox GL JS
- **Backend**: Next.js API Routes
- **Database**: Ready for Supabase/PostgreSQL integration
- **Deployment**: Vercel-ready

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Mapbox account (for map functionality)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd argos
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory:
   ```env
   # Mapbox Access Token (required for map functionality)
   NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
   
   # Database (optional - for future integration)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Get a Mapbox Access Token**
   - Visit [Mapbox](https://www.mapbox.com/)
   - Create a free account
   - Generate an access token
   - Add it to your `.env.local` file

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📱 Usage

### Main Map View
- View global conflicts on an interactive map
- Click markers for detailed conflict information
- Use the legend to understand marker colors
- Access summary statistics at the top

### Arms Deals Page
- Browse comprehensive arms trade data
- Filter by country, status, or search terms
- Sort by date or deal value
- View deal sources and documentation

### News Feed
- Stay updated with conflict-related news
- Filter by region or search headlines
- Access original sources via provided links
- Browse by news source or publication date

### Admin Panel
- **Login**: Use password `admin123` (demo)
- **Add Data**: Create new conflicts, arms deals, or news items
- **Manage**: View and organize existing data
- **Update**: Real-time data modifications

## 🎨 Project Structure

```
argos/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   ├── arms-deals/        # Arms deals page
│   │   ├── news/              # News feed page
│   │   ├── admin/             # Admin panel
│   │   └── layout.tsx         # Root layout
│   ├── components/            # React components
│   │   ├── ConflictMap.tsx    # Interactive map component
│   │   ├── ArmsTable.tsx      # Arms deals table
│   │   ├── NewsFeed.tsx       # News feed component
│   │   └── AdminPanel.tsx     # Admin interface
│   ├── lib/                   # Utilities and data
│   │   └── dummy-data.ts      # Sample data
│   └── types/                 # TypeScript definitions
├── public/                    # Static assets
└── package.json              # Dependencies and scripts
```

## 🗄️ Data Structure

### Conflicts
```typescript
interface Conflict {
  id: string;
  name: string;
  country: string;
  region: string;
  latitude: number;
  longitude: number;
  conflictType: 'border' | 'civil_war' | 'occupation' | 'insurgency' | 'territorial_dispute' | 'other';
  status: 'active' | 'ceasefire' | 'resolved';
  description: string;
  casualties?: number;
  startDate: string;
  lastUpdated: string;
}
```

### Arms Deals
```typescript
interface ArmsDeal {
  id: string;
  date: string;
  buyerCountry: string;
  sellerCountry?: string;
  sellerCompany?: string;
  weaponSystem: string;
  dealValue: number;
  currency: string;
  sourceLink?: string;
  status: 'confirmed' | 'pending' | 'cancelled';
}
```

### News Items
```typescript
interface NewsItem {
  id: string;
  headline: string;
  source: string;
  region?: string;
  date: string;
  url?: string;
  summary?: string;
  tags: string[];
}
```

## 🚀 Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on push

### Other Platforms
The application is compatible with:
- Netlify
- AWS Amplify
- Railway
- Any Node.js hosting service

## 🔮 Roadmap

### Phase 2 Enhancements
- [ ] Real database integration (Supabase/PostgreSQL)
- [ ] User authentication system
- [ ] Data export functionality
- [ ] Advanced analytics dashboard
- [ ] Real-time data updates
- [ ] Mobile app development

### Phase 3 Features
- [ ] AI-powered conflict prediction
- [ ] API for third-party integrations
- [ ] Multi-language support
- [ ] Advanced visualization tools
- [ ] Automated news scraping
- [ ] Blockchain-based data verification

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This application is designed for educational and informational purposes. All data should be verified through official sources. The platform is intended to promote transparency and understanding of global conflicts, not to support any particular political agenda.

## 📞 Support

For questions, issues, or contributions:
- Open an issue on GitHub
- Contact the development team
- Check the documentation

---

**Built with ❤️ for global transparency and peace.**