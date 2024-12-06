// Komponen utama App
function App() {
  const [activeTab, setActiveTab] = React.useState('musimTanam');

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="container">
      <h1 style={{ 
        textAlign: 'center', 
        color: '#064e3b',
        marginBottom: '2rem',
        fontSize: '2rem',
        fontWeight: '600'
      }}>
        Analisa Pertanian Indonesia
      </h1>

      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '2rem',
        borderBottom: '2px solid #e2e8f0',
        paddingBottom: '1rem'
      }}>
        <button
          onClick={() => handleTabChange('musimTanam')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'musimTanam' ? '#059669' : '#e2e8f0',
            color: activeTab === 'musimTanam' ? 'white' : '#4a5568',
            cursor: 'pointer',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          Analisa Musim Tanam
        </button>

        <button
          onClick={() => handleTabChange('usahaTani')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'usahaTani' ? '#059669' : '#e2e8f0',
            color: activeTab === 'usahaTani' ? 'white' : '#4a5568',
            cursor: 'pointer',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          Analisa Usaha Tani
        </button>

        <button
          onClick={() => handleTabChange('ambangEkonomi')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'ambangEkonomi' ? '#059669' : '#e2e8f0',
            color: activeTab === 'ambangEkonomi' ? 'white' : '#4a5568',
            cursor: 'pointer',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          Analisa Ambang Ekonomi Hama
        </button>
      </div>

      <div>
        {activeTab === 'musimTanam' && <MusimTanamAnalysis />}
        {activeTab === 'usahaTani' && <UsahaTaniAnalysis />}
        {activeTab === 'ambangEkonomi' && <PestEconomicAnalysis />}
      </div>
    </div>
  );
}

// Render aplikasi
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  React.createElement(React.StrictMode, null,
    React.createElement(App)
  )
);
