import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { LocationProvider } from './lib/location'
import { ToastProvider } from './lib/toast'
import { BuyerLayout, PartnerLayout, RequireAuth } from './components/Layouts'
import Explore from './pages/buyer/Explore'
import ListingDetail from './pages/buyer/ListingDetail'
import { OrderTicketPage, OrdersPage } from './pages/buyer/Orders'
import { AccountPage, ImpactPage, StorePage } from './pages/buyer/Misc'
import { SignInPage, SignUpPage } from './pages/Auth'
import PartnerDashboard from './pages/partner/Dashboard'
import { ListingForm, PartnerListings } from './pages/partner/Listings'
import { PartnerOrders, PartnerReport, PartnerSchedules, StoreSettings } from './pages/partner/Operations'

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <LocationProvider>
            <Routes>
              <Route path="/masuk" element={<SignInPage />} />
              <Route path="/daftar" element={<SignUpPage />} />
              <Route element={<BuyerLayout />}>
                <Route index element={<Explore />} />
                <Route path="listing/:id" element={<ListingDetail />} />
                <Route path="toko/:id" element={<StorePage />} />
                <Route path="pesanan" element={<RequireAuth><OrdersPage /></RequireAuth>} />
                <Route path="pesanan/:id" element={<RequireAuth><OrderTicketPage /></RequireAuth>} />
                <Route path="dampak" element={<ImpactPage />} />
                <Route path="akun" element={<AccountPage />} />
              </Route>
              <Route path="/mitra" element={<RequireAuth role="partner"><PartnerLayout /></RequireAuth>}>
                <Route index element={<PartnerDashboard />} />
                <Route path="stok" element={<PartnerListings />} />
                <Route path="stok/:id" element={<ListingForm />} />
                <Route path="pesanan" element={<PartnerOrders />} />
                <Route path="jadwal" element={<PartnerSchedules />} />
                <Route path="laporan" element={<PartnerReport />} />
                <Route path="toko" element={<StoreSettings />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </LocationProvider>
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  )
}
