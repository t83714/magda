import React from "react";
import { Route, Switch, Redirect } from "react-router-dom";
import { connect } from "react-redux";
import Search from "../Components/Search/Search";
import Account from "../Components/Account/Account";
import Login from "../Components/Account/Login";
import SignInRedirect from "../Components/Account/SignInRedirect";
import RecordHandler from "../Components/RecordHandler";
import PublishersViewer from "../Components/Publisher/PublishersViewer";
import PublisherDetails from "../Components/Publisher/PublisherDetails";
import StaticPage from "../Components/StaticPage";
import RouteNotFound from "../Components/RouteNotFound";
import Loading from "../Components/Loading";
import ErrorPage from "../Components/ErrorPage/index";
import SuggestDataset from "../Components/RequestDataset/SuggestDataset";
import Header from "../Components/Header/Header";
import SearchBoxSwitcher from "../Components/SearchBox/SearchBoxSwitcher";

import "./OtherPages.css";

const renderBody = (loading, pages) => {
    return (
        <Switch>
            <Route exact path="/search" component={Search} />
            <Route exact path="/account" component={Account} />
            <Route exact path="/login" component={Login} />
            <Route exact path="/sign-in-redirect" component={SignInRedirect} />
            <Route
                path="/dataset/:datasetId/distribution/:distributionId"
                component={RecordHandler}
            />
            <Route path="/dataset/:datasetId" component={RecordHandler} />
            <Route exact path="/suggest" component={SuggestDataset} />
            <Route exact path="/organisations" component={PublishersViewer} />
            <Route
                exact
                path="/publishers"
                render={() => <Redirect to="/organisations" />}
            />
            <Route
                path="/publishers/:publisherId"
                render={({ match }) => (
                    <Redirect
                        to={`/organisations/${match.params.publisherId}`}
                    />
                )}
            />
            <Route
                path="/organisations/:publisherId"
                component={PublisherDetails}
            />
            <Route path="/page/:pageId" component={StaticPage} />
            <Route exact path="/404" component={RouteNotFound} />
            <Route exact path="/error" component={ErrorPage} />
            {loading ? (
                <Loading />
            ) : (
                <Route path="/*" component={RouteNotFound} />
            )}
        </Switch>
    );
};

const OtherPages = props => {
    return (
        <div className="other-page">
            <Header />
            {props.location.pathname !== "/organisations" && (
                <SearchBoxSwitcher
                    location={props.location}
                    theme="none-home"
                />
            )}
            <div
                className={`container app-container ${
                    props.finishedFetching ? "loaded" : "loading"
                }`}
                id="content"
            >
                {renderBody(props.loading, props.pages)}
            </div>
        </div>
    );
};

const mapStateToProps = (state, ownProps) => {
    const datasetIsFetching = state.record.datasetIsFetching;
    const distributionIsFetching = state.record.distributionIsFetching;
    const publishersAreFetching = state.publisher.isFetchingPublishers;
    const datasetSearchIsFetching = state.datasetSearch.isFetching;
    const publisherIsFetching = state.publisher.isFetchingPublisher;
    const pages = state.content.pages;
    const loading = !state.content.isFetched;
    return {
        finishedFetching:
            !datasetIsFetching &&
            !publishersAreFetching &&
            !datasetSearchIsFetching &&
            !distributionIsFetching &&
            !publisherIsFetching,
        pages,
        loading
    };
};

export default connect(mapStateToProps)(OtherPages);
