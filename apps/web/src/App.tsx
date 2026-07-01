import { useMemo, useState } from "react";
import "./App.css";

type View = "landing" | "app";
type AppPage = "dashboard" | "rooms" | "guests" | "finance" | "requests";
type Toast = { id: number; text: string };

const seedCredentials = { email: "owner@thekost.demo", password: "thekost123" };
const photos = [
  "https://lh3.googleusercontent.com/gps-cs-s/APNQkAE9iFzHMKm8SYvdsqYWV9Lvm7pPxCVVGG4S3eQ9HVRRmuIYLkmDGWCKwRszl1l_Rla4B-uKcVw1QmT18Y6OgytrkZn53wo5_yOme6to9XESrJ0Isr5VJ4OVi6MTwS4fBCqOrSM=w1200-h900-k-no",
  "https://lh3.googleusercontent.com/gps-cs-s/APNQkAHe8Q5qGVGNJRRkgIFQVgE4a2hsNEgJrAZ8inVE0h2ivmhM09rS-IkaVI5I2CAvOH7xnf8pLULiEqO7Cg_RmM-QVhc40TI1hzX_FBLwpCMDZ-IOhccF9jimwRBnHxbZikK89ZZwFQ=w900-h1200-k-no",
  "https://lh3.googleusercontent.com/gps-cs-s/APNQkAEhYXgl21UPif1LjH3A-gyFr_gpaI2KL2DgeUC3gaWj8Ih9mD6mBugkkg_OOKcd_R36kWDaf_5CeV64XpeylyolU0c-4xRhnLtlMMV5xkejTDoRSQny55Vq9HIFHE7EuPBsrYW3=w1200-h900-k-no",
];
const reviews = [
  [
    "nabilla",
    "Owner responsif, lingkungan bersih, WiFi lancar, aman dan betah.",
  ],
  ["Shinta", "Fasilitas lengkap, dekat UPN, akses 24 jam big plus."],
  ["Salma", "Nyaman banget, biaya ramah pelajar, cari makan gampang."],
];
const rooms = [
  {
    no: "A1",
    name: "Standard",
    price: "Rp1,25jt",
    status: "Ready",
    guest: "Open",
    img: photos[1],
  },
  {
    no: "B2",
    name: "Plus",
    price: "Rp1,55jt",
    status: "Booked",
    guest: "Shinta",
    img: photos[2],
  },
  {
    no: "C3",
    name: "Long stay",
    price: "Rp1,9jt",
    status: "Paid",
    guest: "Nabilla",
    img: photos[0],
  },
];
const requests = [
  "AC B2 dicek",
  "Tambah token listrik C3",
  "Survey calon penghuni 16:00",
];

function App() {
  const [view, setView] = useState<View>("landing");
  const [page, setPage] = useState<AppPage>("dashboard");
  const [hero, setHero] = useState(0);
  const [authed, setAuthed] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const stats = useMemo(
    () => ({
      occupied: "92%",
      rating: "5.0",
      reviews: "52",
      revenue: "Rp8,7jt",
    }),
    [],
  );
  function toast(text: string) {
    const id = Date.now();
    setToasts((x) => [...x, { id, text }]);
    setTimeout(() => setToasts((x) => x.filter((t) => t.id !== id)), 2400);
  }
  function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAuthed(true);
    setView("app");
    toast("Logged in with seed credentials");
  }

  return (
    <main className="site">
      {view === "landing" ? (
        <Landing
          stats={stats}
          hero={hero}
          setHero={setHero}
          setView={setView}
          toast={toast}
        />
      ) : (
        <DemoApp
          page={page}
          setPage={setPage}
          setView={setView}
          authed={authed}
          login={login}
        />
      )}
      <div className="toast-stack">
        {toasts.map((x) => (
          <div className="toast" key={x.id}>
            {x.text}
          </div>
        ))}
      </div>
    </main>
  );
}

function Landing({
  stats,
  hero,
  setHero,
  setView,
  toast,
}: {
  stats: Record<string, string>;
  hero: number;
  setHero(n: number): void;
  setView(v: View): void;
  toast(t: string): void;
}) {
  return (
    <>
      <header className="topbar">
        <a className="logo" href="#top">
          TheKost
        </a>
        <nav>
          <a href="#rooms">Kamar</a>
          <a href="#reviews">Review</a>
          <a href="#book">Booking</a>
        </nav>
        <div className="social">
          <a
            aria-label="Instagram"
            href="https://instagram.com"
            target="_blank"
          >
            ◎
          </a>
          <a aria-label="TikTok" href="https://tiktok.com" target="_blank">
            ♪
          </a>
          <a
            aria-label="WhatsApp"
            href="https://wa.me/6285117433313"
            target="_blank"
          >
            WA
          </a>
        </div>
      </header>
      <section className="hero" id="top">
        <div className="copy">
          <span className="super">Medokan Ayu · Surabaya</span>
          <h1>Kos clean, aman, dekat UPN.</h1>
          <p>
            Landing + demo app untuk TheKost: calon penghuni cek kamar; owner
            kelola booking, tagihan, request.
          </p>
          <div className="actions">
            <a
              className="cta"
              href="https://wa.me/6285117433313"
              target="_blank"
            >
              Chat WhatsApp
            </a>
            <button onClick={() => setView("app")}>Buka demo app</button>
          </div>
          <div className="seed">
            <b>Seed login</b>
            <span>{seedCredentials.email}</span>
            <span>{seedCredentials.password}</span>
          </div>
        </div>
        <div className="showcase">
          <img src={photos[hero]} alt="TheKost gallery" />
          <div className="thumbs">
            {photos.map((p, i) => (
              <button
                className={i === hero ? "on" : ""}
                onClick={() => setHero(i)}
                key={p}
              >
                <img src={p} alt="" />
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="trust">
        <div>
          <b>{stats.rating}</b>
          <span>Google rating</span>
        </div>
        <div>
          <b>{stats.reviews}</b>
          <span>Reviews</span>
        </div>
        <div>
          <b>{stats.occupied}</b>
          <span>Occupancy</span>
        </div>
        <div>
          <b>24h</b>
          <span>CCTV + akses</span>
        </div>
      </section>
      <section className="features">
        <article>
          <b>01</b>
          <h2>WiFi kencang buat nugas.</h2>
          <p>
            Copy harus terasa kos riil: aman, bersih, dekat kampus, owner
            responsif.
          </p>
        </article>
        <article>
          <b>02</b>
          <h2>Dapur, CCTV, akses 24 jam.</h2>
          <p>Fasilitas prioritas tampil lebih kuat, bukan badge rata semua.</p>
        </article>
        <article>
          <b>03</b>
          <h2>Booking via WhatsApp.</h2>
          <p>CTA sticky dan form singkat memotong friksi survey.</p>
        </article>
      </section>
      <section className="rooms" id="rooms">
        <h2>Pilih kamar</h2>
        <div>
          {rooms.map((r) => (
            <article key={r.no}>
              <img src={r.img} alt={r.name} />
              <span>{r.status}</span>
              <h3>{r.name}</h3>
              <p>
                {r.price} / bulan · {r.guest}
              </p>
              <button onClick={() => toast(`${r.name} selected`)}>
                Lihat detail
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="reviews" id="reviews">
        <h2>Review penghuni</h2>
        {reviews.map(([n, t]) => (
          <article key={n}>
            <b>{n}</b>
            <span>★★★★★</span>
            <p>{t}</p>
          </article>
        ))}
      </section>
      <section className="book" id="book">
        <div>
          <h2>Survey hari ini?</h2>
          <p>
            Jl. Medokan Asri Barat VIII M-20. Dekat kampus, minimarket, warung
            makan.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            toast("Booking request sent");
          }}
        >
          <input placeholder="Nama" required />
          <input placeholder="WhatsApp" required />
          <select>
            <option>Survey kamar</option>
            <option>Booking bulan ini</option>
          </select>
          <button className="cta">Kirim request</button>
        </form>
      </section>
      <button className="sticky-cta" onClick={() => setView("app")}>
        Open demo app
      </button>
      <footer>
        © TheKost Medokan Ayu <span>Instagram · TikTok · WhatsApp</span>
      </footer>
    </>
  );
}

function DemoApp({
  page,
  setPage,
  setView,
  authed,
  login,
}: {
  page: AppPage;
  setPage(p: AppPage): void;
  setView(v: View): void;
  authed: boolean;
  login(e: React.FormEvent<HTMLFormElement>): void;
}) {
  if (!authed)
    return (
      <section className="login">
        <form onSubmit={login}>
          <h1>Owner demo</h1>
          <p>Seed credentials</p>
          <code>
            {seedCredentials.email}
            <br />
            {seedCredentials.password}
          </code>
          <input defaultValue={seedCredentials.email} />
          <input defaultValue={seedCredentials.password} type="password" />
          <button className="cta">Login</button>
          <button type="button" onClick={() => setView("landing")}>
            Back landing
          </button>
        </form>
      </section>
    );
  return (
    <section className="app">
      <aside>
        <b>TheKost OS</b>
        {(
          ["dashboard", "rooms", "guests", "finance", "requests"] as AppPage[]
        ).map((p) => (
          <button
            className={page === p ? "active" : ""}
            onClick={() => setPage(p)}
            key={p}
          >
            {p}
          </button>
        ))}
        <button onClick={() => setView("landing")}>Landing</button>
      </aside>
      <div className="panel">
        <h1>{page}</h1>
        {page === "dashboard" && <Dashboard />}
        {page === "rooms" && <RoomAdmin />}
        {page === "guests" && <Guests />}
        {page === "finance" && <Finance />}
        {page === "requests" && <Requests />}
      </div>
    </section>
  );
}
function Dashboard() {
  return (
    <div className="cards">
      <Card t="Occupancy" v="92%" />
      <Card t="Revenue" v="Rp8,7jt" />
      <Card t="Open tickets" v="3" />
      <Card t="Google" v="5.0" />
    </div>
  );
}
function RoomAdmin() {
  return (
    <div className="table">
      {rooms.map((r) => (
        <p key={r.no}>
          <b>{r.no}</b>
          <span>{r.name}</span>
          <span>{r.price}</span>
          <button>edit</button>
        </p>
      ))}
    </div>
  );
}
function Guests() {
  return (
    <div className="table">
      {["Nabilla", "Shinta", "Salma"].map((n) => (
        <p key={n}>
          <b>{n}</b>
          <span>active tenant</span>
          <span>paid</span>
          <button>chat</button>
        </p>
      ))}
    </div>
  );
}
function Finance() {
  return (
    <div className="cards">
      <Card t="Paid" v="9" />
      <Card t="Pending" v="2" />
      <Card t="Overdue" v="1" />
    </div>
  );
}
function Requests() {
  return (
    <div className="table">
      {requests.map((r) => (
        <p key={r}>
          <b>{r}</b>
          <span>open</span>
          <button>assign</button>
        </p>
      ))}
    </div>
  );
}
function Card({ t, v }: { t: string; v: string }) {
  return (
    <article className="card">
      <span>{t}</span>
      <b>{v}</b>
    </article>
  );
}

export default App;
