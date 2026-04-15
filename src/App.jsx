import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Prenota    from './pages/Prenota'
import Conferma   from './pages/Conferma'
import CheckIn    from './pages/CheckIn'
import Admin      from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Prenota />} />
        <Route path="/prenota"   element={<Prenota />} />
        <Route path="/conferma"  element={<Conferma />} />
        <Route path="/check/:id" element={<CheckIn />} />
        <Route path="/check"     element={<CheckIn />} />
        <Route path="/admin"     element={<Admin />} />
      </Routes>
    </BrowserRouter>
  )
}
