import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ContactList from './components/ContactList'
import ContactDetail from './components/ContactDetail'
import AddContact from './components/AddContact'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<ContactList />} />
          <Route path="/contact/:id" element={<ContactDetail />} />
          <Route path="/add" element={<AddContact />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
