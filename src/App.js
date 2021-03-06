import React from "react";

import { Switch, Route, Redirect, withRouter } from "react-router-dom";

// Static Classes
import Client from "./client";

// Fetch API's
import axios from "./axiosConfig";

// Components
import Checkout from "./components/Checkout/Checkout";
import ErrorMessage from "./components/ErrorMessage/ErrorMessage";
import Loader from "./components/Loader/Loader";
import Instruction from "./components/Instruction/Instruction";
import InputForm from "./components/InputForm/InputForm";
import Events from "./components/Events/Events";
import SelectOptions from "./components/SelectOptions/SelectOptions";
import Facilities from "./components/Facilities/Facilities";
import Button from "react-bootstrap/Button";
import SelectScannerOrPOS from "./components/SelectScannerOrPOS/selectScannerOrPOS";
import Scanner from "./components/Scanner/Scanner";

// Images
import ReaderImg from "./assets/reader-large.png";
import CardsImg from "./assets/cards2.png";
import VeriphoneGif from "./assets/veriphone.gif";
import BlueCheck from "./assets/blueCheck3.png";
import InsertCard from "./assets/creditCard2.png";
import DollarSign from "./assets/dollarSign.png";
import wifiImg from "./assets/wifi.png";

// Static Data
import Cart from "./static/Cart";
import BackendUrls from "./static/BackendUrl";
import ErrorMsgs from "./static/ErrorMsgs";

import "bootstrap/dist/css/bootstrap.min.css";
import "./index.css";

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      chargeAmount: 0,
      taxAmount: 0,
      isLoading: false,
      event: { id: -1, title: "Unknown Event" },
      errorOccured: false,
      errorMsg: null,
      cart: Cart,
      readerRegistered: false,
      currency: "usd",
      prevChargeAmount: null,
      orderId: null,
      askForReceipt: false,
      facility: { id: -1, title: "Unknown Facility" },
    };

    this.client = null;

    this.terminal = null;
  }

  componentDidMount() {
    axios
      .get("/api/pos-products")
      .then((res) => {
        this.setState({ cart: res.data });
      })
      .catch((error) => {
        console.log(error);
      });

    this.setState();
  }

  render() {
    const {
      chargeAmount,
      taxAmount,
      isLoading,
      event,
      errorMsg,
      cart,
      isConnected,
      prevChargeAmount,
      currency,
      orderId,
      askForReceipt,
      facility,
    } = this.state;

    const { history } = this.props;

    const setChargeAmount = (chargeAmount) => {
      this.setState({ chargeAmount });
    };
    const setIsLoading = (isLoading) => {
      this.setState({ isLoading });
    };
    const setEvent = (event) => {
      this.setState({ event });
    };
    const setErrorMsg = (errorMsg) => {
      this.setState({ errorMsg });
    };
    const setCart = (cart) => {
      this.setState({ cart });
    };
    const setIsConnected = (isConnected) => {
      this.setState({ isConnected });
    };
    const setPrevChargeAmount = (prevChargeAmount) => {
      this.setState({ prevChargeAmount });
    };
    const setOrderId = (orderId) => {
      this.setState({ orderId });
    };
    const setAskForReceipt = (askForReceipt) => {
      this.setState({ askForReceipt });
    };
    const setFacility = (facility) => {
      this.setState({ facility });
    };

    const cleanErrorMsg = (error) => {
      let cleanError = null;

      ErrorMsgs.forEach((errorMsg) => {
        if (error.includes(errorMsg.subStr)) {
          cleanError = errorMsg.cleanError;
          return;
        }
      });

      if (cleanError) {
        return cleanError;
      }

      // The ErrorMsg Component maps through a list of errors msgs
      // so error needs to be a list
      return [{ text: error }];
    };

    /**
     * Process:
     *   Run Input Function
     *   Run Loading Screen
     *   Catch Error
     *   Display Error Msg
     *   Stop Loading Screen
     *
     * All Functions that communicate with the reader or terminal
     * Are run through this function
     *
     * Ex. withLoadingAndErrors(collectPayment)
     */

    const withLoadingAndErrors = async (fn, args) => {
      let result = "";
      setIsLoading(true);
      setErrorMsg(null); // Error msg will not show if ErrorMsg is null
      try {
        let result = await fn(args);
      } catch (error) {
        const cleanError = cleanErrorMsg(error.message);
        console.log(error);
        setErrorMsg(cleanError);
        // After an action, your always redirected to the next route. If an error occurs your redirected back
        // Ex. click checkout => routed to insert card => error => routed back to checkout
        history.goBack();
      } finally {
        setIsLoading(false);
      }
      return result;
    };

    //////////////
    // Register //
    //////////////

    const registerAndConnectReader = async (registrationCode) => {
      const reader = await this.client.registerReader({ registrationCode }); // post Request to stripe
      await this.terminal.connectReader(reader); // connect to reader
    };

    const onRegister = (registrationCode) => {
      withLoadingAndErrors(registerAndConnectReader, registrationCode);
      setIsConnected(true);
      history.push("/events");
    };

    //////////////
    // Register //
    //////////////

    const onSelectEvent = (event) => {
      setEvent(event);
      axios
        .get(`http://localhost:8000/api/events/${event.id}/pos-products`)
        .then((res) => {
          setCart(res.data);
        })
        .catch((err) => { });
      history.push("/facilities");
    };

    const onSelectFacility = (facility) => {
      setFacility(facility);
      history.push("/checkout");
    };

    // Return hash of items in cart with qty > 0
    const collectLineItems = () => {
      let lineItems = [];
      cart.forEach((item) => {
        if (item.quantity > 0) {
          let displayItem = {
            description: item.name,
            amount: item.price * 100,
            quantity: item.quantity,
          };
          lineItems.push(displayItem);
        }
      });
      return lineItems;
    };

    const calculateTotalCharge = () => {
      let total = 0;
      cart.forEach((item) => {
        total += item.price * item.quantity;
      });
      return total;
    };

    const changeQuantity = (change, index) => {
      if (cart[index].quantity + change < 0) {
        return;
      }
      const newCart = cart;
      newCart[index].quantity = cart[index].quantity + change;
      setCart(newCart);
    };

    // Changes qty of product in cart when + or - is pressed
    const onQtyChange = (change, index) => {
      changeQuantity(change, index);
      const totalCharge = calculateTotalCharge();
      setChargeAmount(totalCharge);
    };

    //////////////////////
    // On Pay with Cash //
    //////////////////////

    const emptyCart = async () => {
      const newCart = cart;
      newCart.forEach((item) => (item.quantity = 0));
      setCart(newCart);
      setPrevChargeAmount(chargeAmount);
      setChargeAmount(0);
    };

    const createOrder = async (paymentMethod) => {
      const params = {
        event_id: event.id,
        facility_id: facility.id,
        total_charge: 0,
        transaction_id: 10000,
        payment_method: paymentMethod,
      };

      let order_id = 0;

      await axios
        .post("/api/pos-orders", params)
        .then((res) => {
          order_id = res.data.id;
          console.log(res.data);
        })
        .catch((err) => {
          throw err;
        });
      return order_id;
    };

    const createOrderProducts = (order_id) => {
      let purchasedProducts = cart.filter((product) => product.quantity > 0);

      purchasedProducts.forEach(function (product) {
        const orderProductParams = {
          pos_order_id: order_id,
          pos_product_id: product.id,
          quantity: product.quantity,
        };

        axios
          .post("/api/pos-order-pos-products", orderProductParams)
          .then((res) => {
            console.log(res.data);
          })
          .catch((error) => {
            console.log(error);
          });
      });
    };

    const createPurchaseInDB = async (paymentMethod) => {
      setOrderId(-1);
      let order_id = await createOrder(paymentMethod);
      console.log(order_id);
      // Save order_id so that we can update email attribute of order ( /pos-orders/order_id )
      // after purchase is complete. If "Email Reciept" button is pressed.
      setOrderId(order_id);
      createOrderProducts(order_id);
    };

    const itemBought = (itemName) => {
      return cart.find((item) => item.name === itemName && item.quantity > 0);
    };

    const onPayWithCash = async () => {
      setAskForReceipt(false);
      try {
        await createPurchaseInDB("cash");
        if (itemBought("Coaches Packet")) {
          setAskForReceipt(true);
        }
      } catch { }
      emptyCart();
    };

    // Add Additional info to purchase
    const createReaderDisplay = () => {
      const lineItems = collectLineItems();
      const readerDisplay = {
        type: "cart",
        cart: {
          line_items: lineItems,
          tax: taxAmount,
          total: chargeAmount * 100 + taxAmount, // Reader displays 100 as 1.00 so everything needs to be mult by 100
          currency: currency,
        },
      };
      return readerDisplay;
    };

    // Display Items Customer checked out on Reader
    const setReaderDisplay = async () => {
      const readerDisplay = createReaderDisplay();
      await this.terminal.setReaderDisplay(readerDisplay);
    };

    const onCheckout = () => {
      window.scrollTo(0, 0); // scroll to top so user see's error msg
      withLoadingAndErrors(setReaderDisplay);
      history.push("/insert");
    };

    /////////////////
    // Insert Card //
    /////////////////

    const onEditOrder = () => {
      this.terminal.clearReaderDisplay();
      history.push("/checkout");
    };

    const getWebsite = (event) => {
      const websiteId = event.websiteId;
      const websiteIdToName = {
        1: "Prep Hoops",
        2: "Prep Dig",
        3: "PGH",
      };
      return websiteIdToName[websiteId];
    };

    /////////////////////
    // Collect Payment //
    ////////////////////

    // Ex. Output: Prep Showdown - Shirts (2), Adult Whole Event (1), Kid/Senior Day (1)
    const createPaymentIntentDescription = () => {
      let lineItemsStr = "";
      cart.forEach((lineItem) => {
        if (lineItem.quantity > 0) {
          // Notice how stripeLabel is being used. not Label
          lineItemsStr += `${lineItem.name} (${lineItem.quantity}), `;
        }
      });

      lineItemsStr = lineItemsStr.slice(0, -2); // Remove ", " from the end of the string

      const website = getWebsite(event);

      const description = `${website} - ${event.title} - ${lineItemsStr}`;

      return description;
    };

    const createPaymentIntent = () => {
      const description = createPaymentIntentDescription();
      const amount = chargeAmount * 100 + taxAmount; // 100 is read as $1 on reader so must mult by 100
      const paymentIntent = { amount, currency, description };
      return paymentIntent;
    };

    // Run within withLoadingAndErrors() which handles errors
    const collectPayment = async () => {
      const paymentIntent = createPaymentIntent();
      const processedPaymentIntent = await this.client.processPaymentIntent(
        paymentIntent
      );
      const payment = await this.terminal.collectPaymentMethod(
        processedPaymentIntent.secret
      );
      const processedPayment = await this.terminal.processPayment(
        payment.paymentIntent
      );
      const captureResult = await this.client.capturePaymentIntent({
        paymentIntentId: processedPayment.paymentIntent.id,
      });
      return captureResult;
    };

    // this fn cancels PENDING payments. Currently this is not being used
    // instead users can choose to cancel order before paying
    const cancelPayment = async () => {
      await this.terminal.cancelCollectPaymentMethod();
    };

    // payment is NOT PENDING when this fn is run
    // this button is presented. So it doesn't cancel a pending payment
    const onCancelOrder = () => {
      this.terminal.clearReaderDisplay();
      history.push("/checkout");
      emptyCart();
    };

    const onCollectPayment = async () => {
      history.push("/success");
      await withLoadingAndErrors(collectPayment);

      setAskForReceipt(false);

      try {
        await createPurchaseInDB("card");
        if (itemBought("Coaches Packet")) {
          setAskForReceipt(true);
        }
      } catch { }

      emptyCart();
    };

    /////////////////////
    // Component Props //
    /////////////////////

    const wifi = {
      className: "wifi",
      header: "Requirements",
      img: wifiImg,
      // Each elem = new line
      lines: [
        { text: "1. The wifi is working" },
        { text: "2. The wifi is password protected" },
        {
          text:
            "3. This Device and the Veriphone are connected to the same wifi",
        },
      ],
      btns: [
        {
          text: "Next",
          variant: "primary",
          onClick: () => history.push("/mode"),
          // Makes button 100% width
          block: true,
        },
      ],
      help: [
        {
          text: "Nothing happens when card is inserted",
        },
      ],
    };

    const enter07139 = {
      className: "enter07139",
      header: null,
      img: VeriphoneGif,
      lines: [
        // { text: "Enter" },
        { text: "Enter 0 7 1 3 9" },
        // { text: "Into the reader" },
      ],
      btns: [
        {
          text: "Next",
          variant: "primary",
          onClick: () => history.push("/select-scanner-or-POS"),
          block: true, // makes buttons stack vertically and 100% width
        },
        {
          text: "Back",
          variant: "outline-primary",
          onClick: () => history.push("/mode"),
          block: true,
        },
      ],
    };

    const createClient = () => {
      this.client = new Client(BackendUrls.production); // Communicates with API
      this.terminal = this.client.initTerminal();
      history.push("/enter07139");
    };

    const Registration = {
      label: "Registration Code",
      placeholder: "Ex. Sepia-cerulean-orynx",
      btns: [
        {
          text: "Submit",
          variant: "primary",
          onClick: onRegister,
        },
        {
          text: "Back",
          variant: "outline-primary",
          onClick: () => history.push("/enter07139"),
        },
      ],
    };

    const onSubmitEvent = (eventTitle) => {
      const event = { title: eventTitle };
      setEvent(event);
      history.push("/checkout");
    };

    const inputEvent = {
      label: "Event Name",
      placeholder: "Ex. Prep Hoops Circuit",
      btns: [
        {
          text: "Submit",
          variant: "primary",
          onClick: onSubmitEvent,
        },
      ],
    };

    const inputFacility = {
      label: "Facility Name",
      placeholder: "Ex. MN, Roseville",
      btns: [
        {
          text: "Submit",
          variant: "primary",
          onClick: onSubmitEvent,
        },
      ],
    };

    const emailReceipt = (email) => {
      const orderParams = { email };

      axios
        .put(`/api/pos-orders/${orderId}`, orderParams)
        .then((res) => {
          console.log(res.data);
        })
        .catch((error) => {
          console.log(error);
        });

      setPrevChargeAmount(null);
      setAskForReceipt(false);
      history.push("/checkout");
      console.log("receipt emailed!");
    };

    const inputEmail = {
      label: "Email",
      placeholder: "Ex. bob@gmail.com",
      btns: [
        {
          text: "Submit",
          variant: "primary",
          onClick: emailReceipt,
        },
      ],
    };

    const insert = {
      header: "Insert Card",
      img: InsertCard,
      btns: [
        {
          text: "Next",
          variant: "primary",
          block: true,
          onClick: () => history.push("/collect"),
        },
        {
          text: "Edit Order",
          variant: "outline-primary",
          block: true,
          onClick: onEditOrder,
        },
      ],
    };

    const collect = {
      header: "Purchase",
      img: DollarSign,
      btns: [
        {
          text: "Confirm Purchase",
          onClick: onCollectPayment,
          block: true,
        },
        {
          text: "Cancel Purchase",
          variant: "outline-primary",
          onClick: onCancelOrder,
          block: true,
        },
      ],
    };

    const success = {
      header: "Success",
      img: BlueCheck,
      btns: [
        {
          text: "Return to Checkout",
          block: true,
          onClick: () => history.push("/checkout"),
          variant: "outline-primary",
        },
      ],
    };

    const onReset = () => {
      setErrorMsg(null);
      this.terminal.clearReaderDisplay();
    };

    if (isLoading) {
      return <Loader loading={isLoading} />;
    }

    return (
      <div className="app">
        {
          // If a user refreshes page disconnected from the reader.
          // When this happens they are redirected back home
          // !isConnected ? <Redirect to="/" /> : null
        }
        <ErrorMessage
          errorMsgs={errorMsg}
          onClose={() => setErrorMsg()}
          onReset={onReset}
        />
        <Switch>
          <Route path="/register">
            <InputForm
              label={Registration.label}
              placeholder={Registration.placeholder}
              btns={Registration.btns}
            />
          </Route>
          <Route path="/scanner">
            <Scanner
              history={history}
            />
          </Route>
          <Route path="/events">
            <Events
              onSelect={onSelectEvent}
              setIsLoading={setIsLoading}
              history={history}
            />
          </Route>
          <Route path="/facilities">
            <Facilities
              onSelect={onSelectFacility}
              setIsLoading={setIsLoading}
              event_id={event.id}
              history={history}
            />
          </Route>
          <Route path="/email-receipt">
            <InputForm
              label={inputEmail.label}
              placeholder={inputEmail.placeholder}
              btns={inputEmail.btns}
            />
          </Route>
          <Route path="/checkout">
            <Checkout
              cart={cart}
              setCart={setCart}
              onMount={emptyCart}
              chargeAmount={chargeAmount}
              askForReceipt={askForReceipt}
              prevChargeAmount={prevChargeAmount}
              onCheckout={onCheckout}
              onPayWithCash={onPayWithCash}
              onEmailReceipt={() => history.push("/email-receipt")}
              onQtyChange={onQtyChange}
            />
          </Route>
          <Route path="/insert">
            <Instruction
              className={insert.className}
              header={insert.header}
              img={insert.img}
              lines={insert.lines}
              btns={insert.btns}
            />
          </Route>
          <Route path="/collect">
            <Instruction
              header={collect.header}
              className={collect.className}
              img={collect.img}
              btns={collect.btns}
            />
          </Route>
          <Route path="/success">
            <Instruction
              className={success.className}
              header={success.header}
              img={success.img}
              btns={success.btns}
            />
          </Route>
          <Route path="/claim-ticket-success">
            <div onClick={() => history.goBack()}>
              Success! The Ticket was valid and has now been claimed
            </div>
            <Button onClick={() => history.goBack()}>Back</Button>
          </Route>
          <Route path="/claim-ticket-fail">
            <div onClick={() => history.goBack()}>
              Error! This Ticket was already claimed
            </div>
            <Button onClick={() => history.goBack()}>Back</Button>
          </Route>
          <Route path="/register-reader">
            <Instruction
              className={enter07139.className}
              header={enter07139.header}
              img={enter07139.img}
              lines={enter07139.lines}
              btns={enter07139.btns}
            />
          </Route>
          <Route path="/">
            <SelectScannerOrPOS history={history} />
          </Route>
        </Switch>
      </div>
    );
  }
}

export default withRouter(App);
