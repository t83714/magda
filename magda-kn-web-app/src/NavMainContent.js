import React from 'react'
import { Switch, Route } from 'react-router-dom'
import Home from './index/Home'
import About from './about/About'
import AllPublishers from './dataset/AllPublishers'
import DataSetListForOrg from './dataset/DataSetListForOrg'
import DataSetDetail from './dataset/DataSetDetail'
import AboutOrganization from './dataset/AboutOrganization'
import SearchResult from './search/SearchResult'
import DefaultPastYearSearch from './search/DefaultPastYearSearch'
import Datasource from './source/Datasource'
import DatasourceForOrg from './source/DatasourceForOrg'
import Signin from './user/Signin'


const NavMainContent = () =>(
    <div className="container">
        <Switch>
            <Route  exact path='/' component={Home}/>
            <Route exact path='/dataset' component={DefaultPastYearSearch}/>
                <Route exact path='/dataset/:pub_id' component={DataSetListForOrg} />
                <Route exact path='/dataset/:pub_id/:id' component={DataSetDetail} />
            <Route exact path='/search/' component={SearchResult} />
                <Route path='/search/:text' component={SearchResult} />
            <Route exact path='/organisation' component={AllPublishers}/>
                <Route exact path='/organisation/:pub_id' component={AboutOrganization} />
            <Route exact path='/datasource' component={Datasource}/>
                <Route exact path='/datasource/:source_id' component={DatasourceForOrg}/>
            <Route path='/thematic' component={About}/>
            <Route path='/signin' component={Signin}/>
            <Route path='/about' component={About}/>
            
        </Switch>
    </div>
)

export default NavMainContent