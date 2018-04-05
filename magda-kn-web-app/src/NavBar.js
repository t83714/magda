import React, {Component} from 'react'
import { Nav, Navbar, NavItem, NavDropdown,Glyphicon, ButtonToolbar, Dropdown, MenuItem, Image } from 'react-bootstrap'
import { LinkContainer } from 'react-router-bootstrap'
import API from './config'
import './NavBar.css'

export default class NavBar extends Component {
  constructor(props){
    super(props)
    this.state = {user: ''}
  }

  componentDidMount(){
    fetch(API.authApiUrl+"users/whoami", {credentials: "include"})
    .then(res =>{
      if (res.status === 200){
        return res.json()
      }else if (res.status === 401){
        console.log('User is unauthorized')
        return
      }
    })
    .then(json => {
      if(json)  this.setState({user:json})
    })
    .catch(error => console.log(error))
  }


  render() {
    console.log(this.state.user)
    return(
      <Navbar  fixedTop>
        <Navbar.Header>
          <Navbar.Brand>
            <a href="/"> <img  alt="Knowledge Network" src='/img/kn-logo.png' /> </a>
          </Navbar.Brand>
          <Navbar.Toggle />
        </Navbar.Header>
        <Navbar.Collapse>

        <Nav pullRight>
          <NavItem href="/">Home</NavItem>
          <LinkContainer to='/about'>
            <NavItem>About</NavItem>
          </LinkContainer>
   
          <NavDropdown title="Browse" id="browse-dropdown">
            <LinkContainer to='/dataset'>
              <MenuItem>Dataset</MenuItem>
            </LinkContainer>
            <LinkContainer to='/datasource'>
              <MenuItem>Data Source</MenuItem>
            </LinkContainer>
            <LinkContainer to='/organisation'>
              <MenuItem>Organisation</MenuItem>
            </LinkContainer>
          </NavDropdown>
         {
           this.state.user === '' ? 
            <LinkContainer to='/signin'>
              <NavItem>Sign In</NavItem>
            </LinkContainer>
            :
            <NavDropdown title= {
                this.state.user.photoURL === 'none-photoURL'? 
                <Image src='/img/default-user.png' circle /> 
                : <Image src={this.state.user.photoURL} circle />
                }  id="profile-dropdown" noCaret>
              <LinkContainer to='/profile'>
                <MenuItem>Profile</MenuItem>
              </LinkContainer>
              {/* <LinkContainer to='/datasource'>
                <MenuItem>Data Source</MenuItem>
              </LinkContainer> */}
              <MenuItem divider />
              <LinkContainer to='/signout'>
                <MenuItem>Sign Out</MenuItem>
              </LinkContainer>
            </NavDropdown>
         }
          
          {/* <NavDropdown id="nav-dropdown" title="Browse">
              <LinkContainer to='/about' >
                <MenuItem>Spatial Collections</MenuItem>
              </LinkContainer>
              <LinkContainer to='/about' >
                <MenuItem>Datasets</MenuItem>
              </LinkContainer>
              <LinkContainer to='/about' >
                <MenuItem >Playlists</MenuItem>
              </LinkContainer>
              <LinkContainer to='/about' >
                <MenuItem >Users</MenuItem>
              </LinkContainer>
          </NavDropdown>
          <NavItem href="/">Sign In</NavItem>
          */}

        </Nav>
        </Navbar.Collapse>
      </Navbar>
    )
  }

}



 // <nav className="navbar navbar-default navbar-fixed-top">
        //   <div className="container">
        //   <div className="navbar-header">
        //      <Link className="navbar-brand" to="/">
        //        <img  alt="Knowledge Network" src="img/kn-logo.png" />
        //      </Link>
        //    </div>
        //    <div className="collapse navbar-collapse">
        //    <ul className="nav navbar-nav navbar pull-right" role="group">
        //            <li className="nav-item"><Link to="/">Home</Link></li>
        //            <li className="nav-item"><Link to="/about">About</Link></li>
        //            <li className="nav-item dropdown">
        //                 <a className="nav-link dropdown-toggle" data-toggle="dropdown" href="" role="button" aria-haspopup="true" aria-expanded="false">Browse</a>
        //                 <div className="dropdown-menu">
        //                     <Link className="dropdown-item" to="/">Spatial Collections</Link>
        //                     <Link className="dropdown-item" to="/">Datasets</Link>
        //                     <Link className="dropdown-item" to="/">Playlists</Link>
        //                     <Link className="dropdown-item" to="/">Users</Link>
        //                 </div>
        //            </li>
        //        </ul>
        //    </div>
        //    </div>
        // </nav>