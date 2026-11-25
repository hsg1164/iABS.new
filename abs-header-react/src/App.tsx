import Header from "./components/Header";
import { NAV } from "./components/data";

/* أقسام تجريبية لاختبار التمرير — استبدلها بأقسام موقعك (نفس الـ id) */
export default function App() {
  return (
    <>
      <Header />
      <section className="sec" id="home">iABS</section>
      {NAV.map(n => (
        <section className="sec" id={n.id} key={n.id}>{n.ar}</section>
      ))}
    </>
  );
}
