import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/NotFound';
import { Route, Switch } from 'wouter';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import Home from './pages/Home';
const routes=['/','/pos','/sales','/inventory','/receiving','/suppliers','/events','/team','/audit','/settings'];
function Router(){return <Switch>{routes.map(path=><Route key={path} path={path} component={Home}/>)}<Route path="/404" component={NotFound}/><Route component={NotFound}/></Switch>}
export default function App(){return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster/><Router/></TooltipProvider></ThemeProvider></ErrorBoundary>}
