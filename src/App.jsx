import React, { useState, useEffect } from 'react';
import { Search, Play, Info, Plus, Check, Star, LogOut, ShieldAlert, MonitorCheck, Bell, ChevronDown } from 'lucide-react';

const MOCK_MOVIES = {
  trending: [
    { id: 101, title: "Stranger Things", rating: 9.2, year: 2022, duration: "4 Seasons", category: "Sci-Fi / Drama", poster: "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=400", banner: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200", desc: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl." },
    { id: 102, title: "Wednesday", rating: 8.5, year: 2022, duration: "1 Season", category: "Fantasy / Mystery", poster: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=400", banner: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200", desc: "Smart, sarcastic and a little dead inside, Wednesday Addams investigates a murder spree while making new friends — and foes — at Nevermore Academy." },
    { id: 103, title: "Squid Game", rating: 8.7, year: 2021, duration: "1 Season", category: "Thriller / Drama", poster: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=400", banner: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1200", desc: "Hundreds of cash-strapped players accept a strange invitation to compete in children's games. Inside, a tempting prize awaits — with deadly high stakes." }
  ],
  popular: [
    { id: 201, title: "Money Heist (La Casa de Papel)", rating: 8.9, year: 2021, duration: "5 Parts", category: "Action / Crime", poster: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=400", banner: "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1200", desc: "Eight thieves take hostages and lock themselves in the Royal Mint of Spain as a criminal mastermind manipulates the police to carry out his plan." },
    { id: 202, title: "Black Mirror", rating: 8.8, year: 2023, duration: "6 Seasons", category: "Sci-Fi / Thriller", poster: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=400", banner: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200", desc: "This sci-fi anthology series explores a twisted, high-tech near-future where humanity's greatest innovations and darkest instincts collide." },
    { id: 203, title: "The Witcher", rating: 8.1, year: 2023, duration: "3 Seasons", category: "Action / Fantasy", poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=400", banner: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1200", desc: "Geralt of Rivia, a mutated monster-hunter for hire, journeys toward his destiny in a turbulent world where people often prove more wicked than beasts." }
  ],
  topRated: [
    { id: 301, title: "Breaking Bad", rating: 9.5, year: 2013, duration: "5 Seasons", category: "Crime / Drama", poster: "https://images.unsplash.com/photo-1533928298208-27ff66555d8d?q=80&w=400", banner: "https://images.unsplash.com/photo-1533928298208-27ff66555d8d?q=80&w=1200", desc: "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine with a former student in order to secure his family's future." },
    { id: 302, title: "Better Call Saul", rating: 9.0, year: 2022, duration: "6 Seasons", category: "Drama / Crime", poster: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=400", banner: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=1200", desc: "The trials and tribulations of criminal lawyer Jimmy McGill in the years leading up to his fateful run-in with Walter White and Jesse Pinkman." }
  ]
};

export default function App() {
  const [selectedMovie, setSelectedMovie] = useState(MOCK_MOVIES.trending[0]);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [myList, setMyList] = useState([]);
  const [scrolled, setScrolled] = useState(false);

  // Monitor scrolling to style navigation bar
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Filter movies based on search query
  const getAllMovies = () => {
    const all = [...MOCK_MOVIES.trending, ...MOCK_MOVIES.popular, ...MOCK_MOVIES.topRated];
    // Remove duplicates
    return all.filter((movie, index, self) =>
      self.findIndex(m => m.id === movie.id) === index
    );
  };

  const filteredMovies = searchQuery
    ? getAllMovies().filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  const handleToggleList = (movie, e) => {
    e.stopPropagation();
    if (myList.some(m => m.id === movie.id)) {
      setMyList(myList.filter(m => m.id !== movie.id));
    } else {
      setMyList([...myList, movie]);
    }
  };

  return (
    <div className="app">
      {/* Navigation Header */}
      <header className={`nav-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-left">
          <img 
            className="netflix-logo" 
            src="https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg" 
            alt="Netflix" 
          />
          <nav className="nav-menu">
            <a href="#" className="active">Home</a>
            <a href="#">TV Shows</a>
            <a href="#">Movies</a>
            <a href="#">New & Popular</a>
            <a href="#">My List ({myList.length})</a>
          </nav>
        </div>
        <div className="nav-right">
          <div className="search-box">
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              placeholder="Titles, people, genres..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Bell className="icon-btn" size={20} />
          <div className="profile-dropdown">
            <img 
              className="user-avatar" 
              src="https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png" 
              alt="Avatar" 
            />
            <ChevronDown size={14} />
          </div>
        </div>
      </header>

      {/* Main content or Search content */}
      {searchQuery ? (
        <main className="search-results-container">
          <h2 className="section-title">Search Results for "{searchQuery}"</h2>
          {filteredMovies.length > 0 ? (
            <div className="movie-grid">
              {filteredMovies.map(movie => (
                <div 
                  key={movie.id} 
                  className="movie-card"
                  onClick={() => { setSelectedMovie(movie); setModalOpen(true); }}
                >
                  <img src={movie.poster} alt={movie.title} />
                  <div className="card-hover-info">
                    <h4>{movie.title}</h4>
                    <div className="meta">
                      <span className="rating"><Star size={12} fill="gold" stroke="gold" /> {movie.rating}</span>
                      <span>{movie.year}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-results">No movies found matching your search.</p>
          )}
        </main>
      ) : (
        <>
          {/* Hero Banner Section */}
          <section 
            className="hero-banner"
            style={{ backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(11,15,25,1)), url(${selectedMovie.banner})` }}
          >
            <div className="hero-content">
              <span className="category-badge">{selectedMovie.category}</span>
              <h1 className="hero-title">{selectedMovie.title}</h1>
              <p className="hero-description">{selectedMovie.desc}</p>
              <div className="hero-controls">
                <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
                  <Play size={18} fill="black" /> Play
                </button>
                <button className="btn btn-secondary" onClick={() => setModalOpen(true)}>
                  <Info size={18} /> More Info
                </button>
                <button className="btn btn-icon" onClick={(e) => handleToggleList(selectedMovie, e)}>
                  {myList.some(m => m.id === selectedMovie.id) ? <Check size={18} /> : <Plus size={18} />}
                </button>
              </div>
            </div>
          </section>

          {/* Movie Rows */}
          <main className="main-content">
            <section className="movie-row">
              <h3 className="row-title">Trending Now</h3>
              <div className="row-posters">
                {MOCK_MOVIES.trending.map(movie => (
                  <div 
                    key={movie.id} 
                    className="row-poster-card"
                    onClick={() => { setSelectedMovie(movie); setModalOpen(true); }}
                  >
                    <img src={movie.poster} alt={movie.title} />
                    <div className="poster-title">{movie.title}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="movie-row">
              <h3 className="row-title">Popular on Netflix</h3>
              <div className="row-posters">
                {MOCK_MOVIES.popular.map(movie => (
                  <div 
                    key={movie.id} 
                    className="row-poster-card"
                    onClick={() => { setSelectedMovie(movie); setModalOpen(true); }}
                  >
                    <img src={movie.poster} alt={movie.title} />
                    <div className="poster-title">{movie.title}</div>
                  </div>
                ))}
              </div>
            </section>

            {myList.length > 0 && (
              <section className="movie-row">
                <h3 className="row-title">My List</h3>
                <div className="row-posters">
                  {myList.map(movie => (
                    <div 
                      key={movie.id} 
                      className="row-poster-card"
                      onClick={() => { setSelectedMovie(movie); setModalOpen(true); }}
                    >
                      <img src={movie.poster} alt={movie.title} />
                      <div className="poster-title">{movie.title}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="movie-row">
              <h3 className="row-title">Top Rated</h3>
              <div className="row-posters">
                {MOCK_MOVIES.topRated.map(movie => (
                  <div 
                    key={movie.id} 
                    className="row-poster-card"
                    onClick={() => { setSelectedMovie(movie); setModalOpen(true); }}
                  >
                    <img src={movie.poster} alt={movie.title} />
                    <div className="poster-title">{movie.title}</div>
                  </div>
                ))}
              </div>
            </section>
          </main>
        </>
      )}

      {/* DevSecOps Badge Section at the bottom */}
      <footer className="footer-bar">
        <div className="devsecops-shield">
          <MonitorCheck size={18} className="shield-icon" />
          <span>DevSecOps Environment Active</span>
        </div>
        <div className="tmdb-api-status">
          <span className="api-dot green"></span>
          <span>Security Scanning Passed</span>
        </div>
      </footer>

      {/* Details Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div 
              className="modal-hero"
              style={{ backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(17,20,30,1)), url(${selectedMovie.banner})` }}
            >
              <button className="close-btn" onClick={() => setModalOpen(false)}>×</button>
              <div className="modal-hero-content">
                <h2>{selectedMovie.title}</h2>
                <div className="modal-controls">
                  <button className="btn btn-primary"><Play size={16} fill="black" /> Play Now</button>
                  <button className="btn btn-icon" onClick={(e) => handleToggleList(selectedMovie, e)}>
                    {myList.some(m => m.id === selectedMovie.id) ? <Check size={16} /> : <Plus size={16} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-details">
              <div className="details-left">
                <div className="meta-info">
                  <span className="match">98% Match</span>
                  <span className="year">{selectedMovie.year}</span>
                  <span className="duration">{selectedMovie.duration}</span>
                  <span className="hd">HD</span>
                </div>
                <p className="description-text">{selectedMovie.desc}</p>
              </div>
              <div className="details-right">
                <p><span>Genre:</span> {selectedMovie.category}</p>
                <p><span>Rating:</span> {selectedMovie.rating} / 10</p>
                <p><span>Maturity:</span> TV-MA (Mature Audiences)</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
